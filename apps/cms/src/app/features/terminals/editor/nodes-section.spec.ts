import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormArray, FormGroup } from '@angular/forms';
import { provideMarkdown } from 'ngx-markdown';
import { describe, it, expect, beforeEach } from 'vitest';
import { NodesSectionComponent } from './nodes-section';
import { makeNodeGroup } from './terminal-form';

function nodesArray(ids: string[]): FormArray<FormGroup> {
  return new FormArray<FormGroup>(ids.map((id) => makeNodeGroup(id)));
}

describe('NodesSectionComponent', () => {
  let fixture: ComponentFixture<NodesSectionComponent>;
  let component: NodesSectionComponent;
  let host: HTMLElement;

  function setup(ids: string[], brokenNodeIds: string[] = []): void {
    fixture = TestBed.createComponent(NodesSectionComponent);
    component = fixture.componentInstance;
    component.nodes = nodesArray(ids);
    component.brokenNodeIds = brokenNodeIds;
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NodesSectionComponent],
      providers: [provideMarkdown()],
    });
  });

  it('renders every card collapsed by default', () => {
    setup(['start', 'menu']);
    expect(host.querySelectorAll('.node-card').length).toBe(2);
    expect(host.querySelectorAll('.node-body').length).toBe(0);
  });

  it('toggling a card expands only that card', () => {
    setup(['start', 'menu']);
    const firstHeader = host.querySelector('.node-header') as HTMLElement;
    firstHeader.click();
    fixture.detectChanges();
    expect(host.querySelectorAll('.node-body').length).toBe(1);
  });

  it('openNode expands the matching card and marks it active', () => {
    setup(['start', 'menu']);
    component.openNode('menu');
    fixture.detectChanges();

    const active = host.querySelector('.node-card.active');
    expect(active?.getAttribute('data-node-id')).toBe('menu');
    expect(active?.querySelector('.node-body')).not.toBeNull();
  });

  it('openNode for an unknown id is a no-op', () => {
    setup(['start']);
    component.openNode('nope');
    fixture.detectChanges();
    expect(host.querySelector('.node-card.active')).toBeNull();
    expect(host.querySelectorAll('.node-body').length).toBe(0);
  });

  it('emits the active node id when a card is opened', () => {
    setup(['start', 'menu']);
    let emitted: string | null = 'unset';
    component.activeNodeChange.subscribe((id) => (emitted = id));
    component.openNode('start');
    expect(emitted).toBe('start');
  });

  it('shows a broken-target pill on a node with a broken outgoing target', () => {
    setup(['start', 'menu'], ['menu']);
    const menuCard = host.querySelector('.node-card[data-node-id="menu"]');
    const startCard = host.querySelector('.node-card[data-node-id="start"]');
    expect(menuCard?.querySelector('.broken-pill')).not.toBeNull();
    expect(startCard?.querySelector('.broken-pill')).toBeNull();
  });
});
