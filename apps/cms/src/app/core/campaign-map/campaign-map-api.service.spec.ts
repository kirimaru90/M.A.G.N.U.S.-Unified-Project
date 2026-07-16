import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { environment } from '../../../environments/environment';
import { CampaignMapApiService } from './campaign-map-api.service';
import type { CampaignMapDto } from './campaign-map.types';

describe('CampaignMapApiService', () => {
  let service: CampaignMapApiService;
  let http: HttpTestingController;

  const map: CampaignMapDto = {
    config: {
      startLat: 41.9,
      startLng: 12.5,
      startZoom: 6,
      minZoom: 3,
      maxZoom: 18,
      bounds: { south: 35, west: 6, north: 48, east: 19 },
    },
    places: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), CampaignMapApiService],
    });
    service = TestBed.inject(CampaignMapApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the map with a GET on the campaign-scoped URL', () => {
    service.get('c1').subscribe();
    const req = http.expectOne(`${environment.apiBaseUrl}/campaigns/c1/map`);
    expect(req.request.method).toBe('GET');
    req.flush(map);
  });

  it('replaces the map with a PUT carrying the whole document', () => {
    service.replace('c1', map).subscribe();
    const req = http.expectOne(`${environment.apiBaseUrl}/campaigns/c1/map`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(map);
    req.flush(map);
  });
});
