import { describe, it, expect } from 'vitest';
import { success, error, corsPreflight, parseBody } from './responses';

describe('shared/responses', () => {
  it('success() returns 200 with JSON body and CORS headers', () => {
    const res = success({ hello: 'world' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(JSON.parse(res.body)).toEqual({ hello: 'world' });
  });

  it('success() honors a custom status code', () => {
    const res = success({ created: true }, 201);
    expect(res.statusCode).toBe(201);
  });

  it('error() returns the message with the given status code', () => {
    const res = error('Not found', 404);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ message: 'Not found' });
  });

  it('corsPreflight() returns 204 with an empty body', () => {
    const res = corsPreflight();
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
  });

  it('parseBody() parses valid JSON', () => {
    expect(parseBody<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it('parseBody() returns {} for null or invalid JSON', () => {
    expect(parseBody(null)).toEqual({});
    expect(parseBody('not json')).toEqual({});
  });
});
