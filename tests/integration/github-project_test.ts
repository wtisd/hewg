/**
 * Tests for github-project library
 */

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';
import {
  findIteration,
  getCurrentIteration,
  type IterationOption,
  type ProjectField,
} from '../../src/lib/github-project.ts';

describe('findIteration', () => {
  const mockField: ProjectField = {
    id: 'field1',
    name: 'Iteration',
    type: 'ITERATION',
    iterations: [
      { id: 'iter1', title: 'Sprint 1' },
      { id: 'iter2', title: 'Sprint 2' },
      { id: 'iter3', title: 'Sprint 3' },
    ],
  };

  it('should find iteration by exact title', () => {
    const result = findIteration(mockField, 'Sprint 2');
    assertEquals(result?.id, 'iter2');
    assertEquals(result?.title, 'Sprint 2');
  });

  it('should find iteration case-insensitively', () => {
    const result = findIteration(mockField, 'sprint 1');
    assertEquals(result?.id, 'iter1');
  });

  it('should return undefined for non-existent iteration', () => {
    const result = findIteration(mockField, 'Sprint 99');
    assertEquals(result, undefined);
  });
});

describe('getCurrentIteration', () => {
  // Helper to create a date string in YYYY-MM-DD format
  const toDateString = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Helper to create iterations relative to a reference date
  const createIterationsAroundDate = (
    referenceDate: Date,
  ): IterationOption[] => {
    const pastStart = new Date(referenceDate);
    pastStart.setDate(pastStart.getDate() - 21); // 3 weeks ago

    const currentStart = new Date(referenceDate);
    currentStart.setDate(currentStart.getDate() - 3); // 3 days ago (still active)

    const futureStart = new Date(referenceDate);
    futureStart.setDate(futureStart.getDate() + 11); // Starts in 11 days

    return [
      {
        id: 'past',
        title: 'Sprint 1',
        startDate: toDateString(pastStart),
        duration: 14, // 2 weeks
      },
      {
        id: 'current',
        title: 'Sprint 2',
        startDate: toDateString(currentStart),
        duration: 14, // 2 weeks
      },
      {
        id: 'future',
        title: 'Sprint 3',
        startDate: toDateString(futureStart),
        duration: 14, // 2 weeks
      },
    ];
  };

  it('should return current iteration when today is within range', () => {
    const today = new Date();
    const iterations = createIterationsAroundDate(today);
    const field: ProjectField = {
      id: 'field1',
      name: 'Iteration',
      type: 'ITERATION',
      iterations,
    };

    const result = getCurrentIteration(field, today);
    assertEquals(result?.id, 'current');
    assertEquals(result?.title, 'Sprint 2');
  });

  it('should return closest future iteration when no current iteration', () => {
    const today = new Date();
    const futureStart = new Date(today);
    futureStart.setDate(futureStart.getDate() + 5);

    const farFutureStart = new Date(today);
    farFutureStart.setDate(farFutureStart.getDate() + 30);

    const iterations: IterationOption[] = [
      {
        id: 'near',
        title: 'Near Sprint',
        startDate: toDateString(futureStart),
        duration: 14,
      },
      {
        id: 'far',
        title: 'Far Sprint',
        startDate: toDateString(farFutureStart),
        duration: 14,
      },
    ];

    const field: ProjectField = {
      id: 'field1',
      name: 'Iteration',
      type: 'ITERATION',
      iterations,
    };

    const result = getCurrentIteration(field, today);
    assertEquals(result?.id, 'near');
  });

  it('should return closest past iteration when only past iterations exist', () => {
    const today = new Date();
    const recentPastStart = new Date(today);
    recentPastStart.setDate(recentPastStart.getDate() - 20);

    const oldPastStart = new Date(today);
    oldPastStart.setDate(oldPastStart.getDate() - 50);

    const iterations: IterationOption[] = [
      {
        id: 'old',
        title: 'Old Sprint',
        startDate: toDateString(oldPastStart),
        duration: 14,
      },
      {
        id: 'recent',
        title: 'Recent Sprint',
        startDate: toDateString(recentPastStart),
        duration: 14,
      },
    ];

    const field: ProjectField = {
      id: 'field1',
      name: 'Iteration',
      type: 'ITERATION',
      iterations,
    };

    const result = getCurrentIteration(field, today);
    assertEquals(result?.id, 'recent');
  });

  it('should return undefined when no iterations exist', () => {
    const field: ProjectField = {
      id: 'field1',
      name: 'Iteration',
      type: 'ITERATION',
      iterations: [],
    };

    const result = getCurrentIteration(field);
    assertEquals(result, undefined);
  });

  it('should return first iteration when no date info available', () => {
    const iterations: IterationOption[] = [
      { id: 'iter1', title: 'Sprint 1' },
      { id: 'iter2', title: 'Sprint 2' },
    ];

    const field: ProjectField = {
      id: 'field1',
      name: 'Iteration',
      type: 'ITERATION',
      iterations,
    };

    const result = getCurrentIteration(field);
    assertEquals(result?.id, 'iter1');
  });

  it('should handle iteration on start date boundary', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const iterations: IterationOption[] = [
      {
        id: 'starting',
        title: 'Starting Today',
        startDate: toDateString(today),
        duration: 14,
      },
    ];

    const field: ProjectField = {
      id: 'field1',
      name: 'Iteration',
      type: 'ITERATION',
      iterations,
    };

    const result = getCurrentIteration(field, today);
    assertEquals(result?.id, 'starting');
  });

  it('should handle iteration on end date boundary', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 14); // Started 14 days ago, ends today

    const iterations: IterationOption[] = [
      {
        id: 'ending',
        title: 'Ending Today',
        startDate: toDateString(startDate),
        duration: 14,
      },
    ];

    const field: ProjectField = {
      id: 'field1',
      name: 'Iteration',
      type: 'ITERATION',
      iterations,
    };

    const result = getCurrentIteration(field, today);
    assertEquals(result?.id, 'ending');
  });
});
