/**
 * Which resources a port answered only after the caller's signal had
 * aborted.
 *
 * The coordinator reports a request aborted in flight exactly as the port
 * answered it - attempted, so its accounting stays exact - and it does not
 * say *when* an answer arrived. A caller that must not accept an answer that
 * arrived after its own cancellation (the coordinated run budget, RB-4 as
 * amended on 2026-10-06) registers its port through this pass-through
 * instead. It changes nothing the port answers, the coordinator decides or
 * the accounting counts: it only notes, per resource, that the answer came
 * after the abort.
 */

import type { ProviderResourcePort, ProviderResourceRequest } from './port';
import { resourceKey, type CoordinatedResource } from './resource';

export interface LateAnswerRecord {
  /** The port to register in place of the one it wraps. */
  readonly port: ProviderResourcePort;
  /** Whether `resource` was answered only after the request's signal aborted. */
  answeredAfterAbort(resource: CoordinatedResource): boolean;
}

export function recordLateAnswers(
  port: ProviderResourcePort,
): LateAnswerRecord {
  const late = new Set<string>();
  const registered: ProviderResourcePort = Object.freeze({
    sourceId: port.sourceId,
    fetchResource: async (request: ProviderResourceRequest) => {
      const answer = await port.fetchResource(request);
      if (request.signal?.aborted === true) {
        late.add(resourceKey(request.resource));
      }
      return answer;
    },
  });
  return Object.freeze({
    port: registered,
    answeredAfterAbort: (resource: CoordinatedResource) =>
      late.has(resourceKey(resource)),
  });
}
