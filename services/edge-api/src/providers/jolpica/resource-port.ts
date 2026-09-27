/**
 * The single Jolpica `ProviderResourcePort` a coordinator registers.
 *
 * The coordinator accepts exactly one port per source, and Jolpica is served by
 * five: calendar, circuits, participants, race classification, and the two
 * standings resources, which share one port. This port is the one registration
 * for source `jolpica`. It routes each request by resource to the port that
 * owns it, and does nothing else. It decides no outcome, holds no payload,
 * retries nothing and makes no request of its own.
 *
 * A resource outside the routes is refused as `resource-unsupported` here,
 * before any port, reservation or transport is reached. That covers
 * `event-schedule` and every classification except the race. Each routed port
 * also still refuses everything outside its own capability, so an unsupported
 * resource cannot reach the limiter even if a route were ever widened.
 */

import type {
  CoordinatedResource,
  CoordinatedResourceKind,
  CoordinatedSourceId,
  ProviderResourceOutcome,
  ProviderResourcePort,
  ProviderResourceRequest,
} from '../coordination';

/** The five Jolpica ports, one per owned resource family. */
export interface JolpicaResourcePorts {
  readonly calendar: ProviderResourcePort;
  readonly circuits: ProviderResourcePort;
  readonly participants: ProviderResourcePort;
  readonly results: ProviderResourcePort;
  readonly standings: ProviderResourcePort;
}

/** Which port owns each routed resource kind. `event-schedule` has none. */
const routes: ReadonlyMap<CoordinatedResourceKind, keyof JolpicaResourcePorts> =
  new Map<CoordinatedResourceKind, keyof JolpicaResourcePorts>([
    ['season-calendar', 'calendar'],
    ['season-circuits', 'circuits'],
    ['season-participants', 'participants'],
    ['session-classification', 'results'],
    ['driver-standings', 'standings'],
    ['constructor-standings', 'standings'],
  ]);

const unsupported: ProviderResourceOutcome = Object.freeze({
  outcome: 'not-attempted',
  reason: 'resource-unsupported',
});

export class JolpicaResourcePort implements ProviderResourcePort {
  readonly sourceId: CoordinatedSourceId = 'jolpica';

  private readonly ports: JolpicaResourcePorts;

  constructor(ports: JolpicaResourcePorts) {
    for (const port of Object.values(ports) as ProviderResourcePort[]) {
      if (port.sourceId !== 'jolpica') {
        // A port for another source behind this registration would attribute
        // its work to Jolpica. There is no safe default, so wiring fails.
        throw new TypeError('Every routed port must belong to source jolpica.');
      }
    }
    this.ports = Object.freeze({ ...ports });
  }

  async fetchResource(
    request: ProviderResourceRequest,
  ): Promise<ProviderResourceOutcome> {
    const port = this.portFor(request.resource);
    if (port === null) return unsupported;
    return port.fetchResource(request);
  }

  private portFor(resource: CoordinatedResource): ProviderResourcePort | null {
    const owner = routes.get(resource.kind);
    if (owner === undefined) return null;
    if (
      resource.kind === 'session-classification' &&
      resource.sessionType !== 'race'
    ) {
      return null;
    }
    return this.ports[owner];
  }
}
