import type { z } from "zod";
import { ConversionRecordedV1 } from "./events/conversion-recorded.js";
import { CustomEventTrackedV1 } from "./events/custom-event-tracked.js";
import { ElementClickedV1 } from "./events/element-clicked.js";
import { IdentifiedV1 } from "./events/identified.js";
import { PageViewedV1 } from "./events/page-viewed.js";
import { SessionStartedV1 } from "./events/session-started.js";

export const EVENT_TYPES = [
  "SessionStarted",
  "PageViewed",
  "ElementClicked",
  "CustomEventTracked",
  "Identified",
  "ConversionRecorded",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type AnyEventV1 =
  | z.infer<typeof SessionStartedV1>
  | z.infer<typeof PageViewedV1>
  | z.infer<typeof ElementClickedV1>
  | z.infer<typeof CustomEventTrackedV1>
  | z.infer<typeof IdentifiedV1>
  | z.infer<typeof ConversionRecordedV1>;

type EventSchema = z.ZodType<AnyEventV1>;

function versions(schema: EventSchema): ReadonlyMap<number, EventSchema> {
  return new Map<number, EventSchema>([[1, schema]]);
}

/** type -> version -> schema. Published versions are never edited (ES-07). */
export const eventRegistry: ReadonlyMap<EventType, ReadonlyMap<number, EventSchema>> = new Map<
  EventType,
  ReadonlyMap<number, EventSchema>
>([
  ["SessionStarted", versions(SessionStartedV1)],
  ["PageViewed", versions(PageViewedV1)],
  ["ElementClicked", versions(ElementClickedV1)],
  ["CustomEventTracked", versions(CustomEventTrackedV1)],
  ["Identified", versions(IdentifiedV1)],
  ["ConversionRecorded", versions(ConversionRecordedV1)],
]);
