import { Directive, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { CatalogOp, catalogEditOps, catalogErrorMessage } from './catalog-ops';

export type CatalogSaveKind = 'created' | 'updated';

/** What a dialog's form reads as: the slug and entry to save, or a validation message. */
export type CatalogFormRead<S> = { slug: string; entry: S } | { error: string };

/**
 * The save flow shared by the catalog entry dialogs. `entry` is `null` to
 * create, otherwise the entry being edited. Subclasses own the form: they
 * reset it on open, read it on submit, and send the ops to their catalog.
 *
 * On failure the dialog stays open with the form untouched, so the admin's
 * edits survive a 409 or 400.
 */
@Directive()
export abstract class CatalogEntryDialogBase<E extends { slug: string }, S> implements OnChanges {
  @Input() visible = false;
  @Input() entry: E | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<CatalogSaveKind>();

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected abstract resetForm(entry: E | null): void;
  protected abstract readForm(): CatalogFormRead<S>;
  protected abstract patch(ops: CatalogOp<S>[]): Observable<unknown>;

  protected get isEdit(): boolean {
    return this.entry !== null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['visible'] || changes['entry']) && this.visible) {
      this.error.set(null);
      this.saving.set(false);
      this.resetForm(this.entry);
    }
  }

  protected submit(): void {
    this.error.set(null);
    const read = this.readForm();
    if ('error' in read) {
      this.error.set(read.error);
      return;
    }

    const original = this.entry?.slug ?? null;
    this.saving.set(true);
    this.patch(catalogEditOps(original, read.slug, read.entry)).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit(original === null ? 'created' : 'updated');
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(catalogErrorMessage(err, { slug: read.slug, action: original === null ? 'add' : 'update' }));
      },
    });
  }
}
