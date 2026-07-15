import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { merge } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { TerminalsApiService } from '../../../core/terminal/terminals-api.service';
import { CurrentCampaignService } from '../../../core/campaign/current-campaign.service';
import type { TerminalContent } from '../../../domain/terminal-schema';
import { TerminalContentSchema } from '../../../domain/terminal-schema';
import type { FictionalUserCredential } from '../../../core/terminal/terminal.types';
import type { StateEntryShape } from '../../../core/state/state.types';
import { resolveControlByPath, toContent, toForm } from './terminal-form';
import { deriveFlowGraph, type FlowGraph } from './flow-graph.model';
import { MetadataSectionComponent } from './metadata-section';
import { StateSchemaSectionComponent } from './state-schema-section';
import { FictionalUsersSectionComponent } from './fictional-users-section';
import { NodesSectionComponent } from './nodes-section';
import { TerminalFlowGraphComponent } from './terminal-flow-graph';

const EMPTY_GRAPH: FlowGraph = { nodes: [], edges: [], entryId: null, unreachable: [], broken: [] };
const GRAPH_DEBOUNCE_MS = 150;

@Component({
  selector: 'app-terminal-editor',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MetadataSectionComponent,
    StateSchemaSectionComponent,
    FictionalUsersSectionComponent,
    TerminalFlowGraphComponent,
    NodesSectionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="terminal-editor">

      <!-- Validation summary (unresolvable Zod issues) -->
      @if (validationSummary.length) {
        <div class="validation-summary">
          <strong>Errori di validazione:</strong>
          <ul>
            @for (issue of validationSummary; track issue) {
              <li>{{ issue }}</li>
            }
          </ul>
        </div>
      }

      <!-- API error -->
      @if (apiError) {
        <div class="api-error">{{ apiError }}</div>
      }

      <app-metadata-section [metaGroup]="metaGroup" />
      <app-state-schema-section [localVars]="localVarsArray" [globalVars]="globalVarsArray" [campaignGlobalSchema]="campaignGlobalSchema()" />
      <app-fictional-users-section [users]="usersArray" [gateOnBoot]="gateOnBootControl" />
      <app-terminal-flow-graph
        [graph]="graph()"
        [activeNodeId]="graphActiveId()"
        (nodeSelected)="nodesSection.openNode($event)"
      />
      <app-nodes-section
        #nodesSection
        [nodes]="nodesArray"
        [availableUsernames]="availableUsernames"
        [availableKeys]="availableKeys"
        [brokenNodeIds]="brokenNodeIds()"
        (activeNodeChange)="graphActiveId.set($event)"
      />
    </div>
  `,
  styles: [`
    .terminal-editor { }
    .validation-summary { background: #fdf3f3; border: 1px solid #e74c3c; border-radius: 6px; padding: 12px; margin-bottom: 12px; font-size: 13px; color: #c0392b; }
    .validation-summary ul { margin: 6px 0 0; padding-left: 20px; }
    .api-error { background: #fdf3f3; border: 1px solid #e74c3c; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; font-size: 13px; color: #c0392b; }
  `],
})
export class TerminalEditorComponent implements OnInit {
  @Input({ required: true }) terminalId!: string;
  @Input({ required: true }) content!: TerminalContent;
  @Input() fictionalUsers: FictionalUserCredential[] = [];
  @Output() readonly saved = new EventEmitter<void>();

  private readonly terminalsApi = inject(TerminalsApiService);
  private readonly currentCampaign = inject(CurrentCampaignService);
  private readonly messageService = inject(MessageService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly campaignGlobalSchema = computed<Record<string, StateEntryShape> | null>(() => {
    const state = this.currentCampaign.currentCampaign()?.state;
    if (!state) return null;
    const schema: Record<string, StateEntryShape> = {};
    for (const [name, entry] of Object.entries(state)) {
      schema[name] = { type: entry.type, default: entry.default as boolean | number | string, ...(entry.values ? { values: entry.values } : {}) };
    }
    return schema;
  });

  protected form!: FormGroup;
  /** Exposed as a signal so the detail page's header actions react to it. */
  readonly dirty = signal(false);
  protected validationSummary: string[] = [];
  protected apiError: string | null = null;
  protected availableUsernames: string[] = [];
  protected availableKeys: string[] = [];

  /** Flow graph derived from the current (unsaved) form content. */
  protected readonly graph = signal<FlowGraph>(EMPTY_GRAPH);
  /** The node whose card is currently open, reflected as the graph's active node. */
  protected readonly graphActiveId = signal<string | null>(null);
  /** Node ids with a broken outgoing target, surfaced as pills on the node cards. */
  protected readonly brokenNodeIds = computed(() =>
    Array.from(new Set(this.graph().broken.map((b) => b.from))),
  );

  private baseline!: TerminalContent;

  ngOnInit(): void {
    this.baseline = this.content;
    this.buildForm(this.content);
  }

  private buildForm(content: TerminalContent): void {
    this.form = toForm(content, this.fictionalUsers);
    this.addRequiredValidators();
    this.dirty.set(false);
    this.form.valueChanges.subscribe(() => {
      this.dirty.set(true);
    });
    // Derive the flow graph now and on every relevant form change (add/remove a
    // node or edit a target both surface as valueChanges), debounced per D7.
    this.graphActiveId.set(null);
    this.recomputeGraph();
    this.form.valueChanges.pipe(debounceTime(GRAPH_DEBOUNCE_MS)).subscribe(() => {
      this.recomputeGraph();
    });
    this.computeAvailableUsernames();
    this.computeAvailableKeys();
    this.usersArray.valueChanges.pipe(startWith(null)).subscribe(() => {
      this.computeAvailableUsernames();
      this.cdr.markForCheck();
    });
    merge(this.localVarsArray.valueChanges, this.globalVarsArray.valueChanges)
      .pipe(startWith(null))
      .subscribe(() => {
        this.computeAvailableKeys();
        this.cdr.markForCheck();
      });
  }

  private recomputeGraph(): void {
    const content = toContent(this.form.getRawValue()) as TerminalContent;
    this.graph.set(deriveFlowGraph(content));
  }

  private computeAvailableUsernames(): void {
    this.availableUsernames = this.usersArray.controls
      .map((c) => (c.get('username')?.value as string) ?? '')
      .filter(Boolean);
  }

  private computeAvailableKeys(): void {
    const local = this.localVarsArray.controls
      .map((c) => (c.get('name')?.value as string) ?? '')
      .filter(Boolean)
      .map((n) => `local.${n}`);
    const global = this.globalVarsArray.controls
      .map((c) => (c.get('name')?.value as string) ?? '')
      .filter(Boolean)
      .map((n) => `global.${n}`);
    this.availableKeys = [...local, ...global];
  }

  private addRequiredValidators(): void {
    this.form.get('meta.title')?.addValidators(Validators.required);
    for (const ctrl of this.nodesArray.controls) {
      (ctrl as FormGroup).get('id')?.addValidators(Validators.required);
    }
  }

  get metaGroup(): FormGroup {
    return this.form.get('meta') as FormGroup;
  }

  get localVarsArray(): FormArray<FormGroup> {
    return this.form.get('stateLocal') as FormArray<FormGroup>;
  }

  get globalVarsArray(): FormArray<FormGroup> {
    return this.form.get('stateGlobal') as FormArray<FormGroup>;
  }

  get usersArray(): FormArray<FormGroup> {
    return this.form.get('users') as FormArray<FormGroup>;
  }

  get gateOnBootControl(): FormControl<boolean> {
    return this.form.get('loginGateOnBoot') as FormControl<boolean>;
  }

  get nodesArray(): FormArray<FormGroup> {
    return this.form.get('nodes') as FormArray<FormGroup>;
  }

  save(): void {
    this.validationSummary = [];
    this.apiError = null;

    this.form.markAllAsTouched();

    const raw = this.form.getRawValue();
    const serialized = toContent(raw);
    const result = TerminalContentSchema.safeParse(serialized);

    if (!result.success) {
      const unresolved: string[] = [];
      for (const issue of result.error.issues) {
        const ctrl = resolveControlByPath(this.form, issue.path as (string | number)[]);
        if (ctrl) {
          ctrl.setErrors({ schema: issue.message });
        } else {
          unresolved.push(`${issue.path.join('.')}: ${issue.message}`);
        }
      }
      this.validationSummary = unresolved;
      return;
    }

    this.terminalsApi.update(this.terminalId, result.data).subscribe({
      next: (envelope) => {
        this.baseline = envelope.content;
        this.fictionalUsers = envelope.fictionalUsers;
        this.buildForm(this.baseline);
        this.saved.emit();
        this.messageService.add({
          severity: 'success',
          summary: 'Salvato',
          detail: 'Terminale aggiornato con successo',
        });
      },
      error: (err: unknown) => {
        this.dirty.set(true);
        const msg = (err as { error?: { message?: string }; message?: string })?.error?.message
          ?? (err as { message?: string })?.message
          ?? 'Errore durante il salvataggio';
        this.apiError = msg;
      },
    });
  }

  discard(): void {
    if (!this.dirty()) return;
    const confirmed = window.confirm('Annullare tutte le modifiche non salvate?');
    if (confirmed) {
      this.buildForm(this.baseline);
    }
  }
}
