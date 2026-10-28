import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// The source module, not the package: the installed package is the last released protocol, while this test checks
// the wire list as it is in the repository.
import { UNITY_PLAIN_MESSAGES, UNITY_PREFIXED_MESSAGES } from '../../../protocol/src/unityWire';

const UNITY_RUNTIME_DIR = join(__dirname, '../../../unity/Assets/WebBridge/Runtime');
const SEND_CALL = /WebBridgeUtils\.Send\(([^;]+)\);/g;
const PLAIN_LITERAL = /(?<!\$)"([^"{}]+)"/g;
const MESSAGE_CONSTANT = /const string \w*(?:Message|Prefix|Base) = "([^"]+)"/g;
const PREFIX_SUFFIX = '_';

const readRuntimeSources = (): string[] =>
  readdirSync(UNITY_RUNTIME_DIR)
    .filter((file) => file.endsWith('.cs'))
    .map((file) => readFileSync(join(UNITY_RUNTIME_DIR, file), 'utf8'));

const collectSentStrings = (sources: readonly string[]): Set<string> => {
  const sent = new Set<string>();
  for (const source of sources) {
    for (const [, argument] of source.matchAll(SEND_CALL)) {
      for (const [, literal] of argument!.matchAll(PLAIN_LITERAL)) sent.add(literal!);
    }
    for (const [, value] of source.matchAll(MESSAGE_CONSTANT)) sent.add(value!);
  }
  return sent;
};

const sentStrings = [...collectSentStrings(readRuntimeSources())];
const isPrefix = (message: string): boolean => message.endsWith(PREFIX_SUFFIX);

describe('unityWire', () => {
  it('finds the messages the Unity package sends', () => {
    expect(sentStrings).toContain('SpinReady');
    expect(sentStrings).toContain('PlaySound_');
  });

  it('lists every plain message the Unity package sends', () => {
    const listed: readonly string[] = UNITY_PLAIN_MESSAGES;
    const plain = sentStrings.filter((message) => !isPrefix(message));

    expect(plain.filter((message) => !listed.includes(message))).toEqual([]);
  });

  it('lists every message prefix the Unity package sends', () => {
    const prefixes: readonly string[] = Object.values(UNITY_PREFIXED_MESSAGES);

    expect(sentStrings.filter(isPrefix).filter((prefix) => !prefixes.includes(prefix))).toEqual([]);
  });
});
