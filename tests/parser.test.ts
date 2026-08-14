import { describe, it, expect } from 'vitest';
import { ruleBasedExtract } from '../src/ai/parser';

describe('ruleBasedExtract', () => {
  it('extracts origin, destination and relative date from "Delhi to Dubai tomorrow"', () => {
    const result = ruleBasedExtract('I want to fly from Delhi to Dubai tomorrow.');
    expect(result.intent).toBe('SEARCH_FLIGHT');
    expect(result.entities.origin).toBe('DEL');
    expect(result.entities.destination).toBe('DXB');
    expect(result.entities.departureDate).toBeTruthy();
  });

  it('extracts passenger count and destination-only phrasing', () => {
    const result = ruleBasedExtract('Show me flights from Delhi to Mumbai for 2 people on 20 August.');
    expect(result.entities.origin).toBe('DEL');
    expect(result.entities.destination).toBe('BOM');
    expect(result.entities.passengers).toBe(2);
    expect(result.entities.departureDate).toMatch(/-08-20$/);
  });

  it('detects BOOK_FLIGHT intent and flight ordinal', () => {
    const result = ruleBasedExtract('Book the first one.');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.flightOrdinal).toBe(1);
  });

  it('detects CHECK_IN intent with PNR', () => {
    const result = ruleBasedExtract('Check me in for A7K9P2, last name Bhargava');
    expect(result.intent).toBe('CHECK_IN');
    expect(result.entities.pnr).toBe('A7K9P2');
  });

  it('detects BOOKING_HISTORY intent', () => {
    const result = ruleBasedExtract('Show my previous bookings');
    expect(result.intent).toBe('BOOKING_HISTORY');
  });

  it('detects GREETING intent', () => {
    const result = ruleBasedExtract('Hello there');
    expect(result.intent).toBe('GREETING');
  });

  it('falls back to UNKNOWN for unrelated input', () => {
    const result = ruleBasedExtract('What is the weather like?');
    expect(result.intent).toBe('UNKNOWN');
  });

  it('flags missing fields for an incomplete search', () => {
    const result = ruleBasedExtract('I need a flight from Delhi to Singapore');
    expect(result.missingFields).toContain('departureDate');
  });
});
