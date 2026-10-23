import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DormantReactivationSection } from '../Franchisees';

describe('DormantReactivationSection (Franchisees UI)', () => {

  it('renders candidates in correct rule-based ranking order and displays all required metrics without probabilities', () => {
    const mockCandidates = [
      {
        franchisee_id: 101,
        franchisee_name: 'Alpha Hub',
        days_since_last_placement: 95,
        placements_l12m: 12,
        avg_company_share: 25000,
        expected_monthly_value: 25000,
        total_lifetime_placements: 18,
        explanation: 'Placed 12 in last 12m, last placement 95d ago.'
      },
      {
        franchisee_id: 102,
        franchisee_name: 'Beta Hub',
        days_since_last_placement: 120,
        placements_l12m: 6,
        avg_company_share: 20000,
        expected_monthly_value: 10000,
        total_lifetime_placements: 10,
        explanation: 'Placed 6 in last 12m, last placement 120d ago.'
      },
      {
        franchisee_id: 103,
        franchisee_name: 'Gamma Hub',
        days_since_last_placement: 150,
        placements_l12m: 3,
        avg_company_share: 15000,
        expected_monthly_value: 3750,
        total_lifetime_placements: 5,
        explanation: 'Placed 3 in last 12m, last placement 150d ago.'
      }
    ];

    const mockSummary = {
      total_potential_monthly_recovery: 38750,
      dormant_candidates_count: 3
    };

    const html = renderToStaticMarkup(
      <DormantReactivationSection
        candidates={mockCandidates}
        summary={mockSummary}
        loading={false}
        monthlyCostGap={45000}
      />
    );

    // 1. Title and required label & tooltip
    expect(html).toContain('Dormant franchisees to reactivate');
    expect(html).toContain('Rule-based ranking');
    expect(html).toContain('Assumes the hub returns to its recent pace; upper bound, not a forecast.');

    // 2. Recovery potential ceiling and monthly cost gap
    expect(html).toContain('up to');
    expect(html).toContain('monthly cost gap:');

    // 3. Proper Sort Order: Alpha Hub first, Beta Hub second, Gamma Hub third
    const alphaIdx = html.indexOf('Alpha Hub');
    const betaIdx = html.indexOf('Beta Hub');
    const gammaIdx = html.indexOf('Gamma Hub');

    expect(alphaIdx).toBeGreaterThan(-1);
    expect(betaIdx).toBeGreaterThan(alphaIdx);
    expect(gammaIdx).toBeGreaterThan(betaIdx);

    // 4. Required Columns: Days ago, Placements, Avg Company Share, Expected Monthly Value
    expect(html).toContain('95d ago');
    expect(html).toContain('120d ago');
    expect(html).toContain('150d ago');

    // 5. NO probabilities anywhere
    expect(html).not.toMatch(/[0-9]+% probability/i);
    expect(html).not.toMatch(/probability/i);
    expect(html).not.toMatch(/auc/i);
  });

  it('filters out never-activated hubs with zero lifetime placements', () => {
    const mockCandidates = [
      {
        franchisee_id: 201,
        franchisee_name: 'Active In Past Hub',
        days_since_last_placement: 110,
        placements_l12m: 4,
        avg_company_share: 18000,
        expected_monthly_value: 6000,
        total_lifetime_placements: 6
      },
      {
        franchisee_id: 202,
        franchisee_name: 'Never Activated Ghost Hub',
        days_since_last_placement: 999,
        placements_l12m: 0,
        avg_company_share: 0,
        expected_monthly_value: 0,
        total_lifetime_placements: 0 // never placed
      }
    ];

    const html = renderToStaticMarkup(
      <DormantReactivationSection
        candidates={mockCandidates}
        loading={false}
      />
    );

    expect(html).toContain('Active In Past Hub');
    expect(html).not.toContain('Never Activated Ghost Hub');
  });

  it('renders clean empty state when no dormant candidates are eligible', () => {
    const html = renderToStaticMarkup(
      <DormantReactivationSection
        candidates={[]}
        summary={{ total_potential_monthly_recovery: 0 }}
        loading={false}
      />
    );

    expect(html).toContain('Dormant franchisees to reactivate');
    expect(html).toContain('No dormant franchise hubs currently eligible for reactivation.');
    expect(html).not.toContain('<table');
  });

});
