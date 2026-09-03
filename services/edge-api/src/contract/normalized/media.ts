/**
 * Media value objects.
 *
 * `MediaVariants` is the one place the contract declares genuinely **optional**
 * properties (`contract/types.ts` spells them with `?`), so an absent variant
 * is valid and a present-but-null one is valid too. Every other declared
 * property in the normalized contract must be present.
 *
 * `entityId` and `fallbackCategory` are validated as plain strings rather than
 * as a slug and a category vocabulary: the OpenAPI schema declares both as
 * `[string, "null"]`, and the TypeScript aliases (`Slug = string`) impose no
 * constraint of their own. Tightening either here would reject data the
 * authoritative contract calls valid.
 */

import { MEDIA_CATEGORIES, MEDIA_ENTITY_TYPES, MEDIA_FORMATS } from '../enums';
import { objectOf, nullableObjectOf, type Field } from './object';
import type { Check } from './values';
import {
  absoluteUrl,
  enumOf,
  gridViewId,
  int,
  nullable,
  num,
  str,
} from './values';

const variantFields: readonly Field[] = [
  { key: 'url', check: absoluteUrl },
  { key: 'width', check: nullable(int) },
  { key: 'height', check: nullable(int) },
];

export const mediaVariant: Check = objectOf(variantFields);

const variantsFields: readonly Field[] = [
  { key: 'thumbnail', check: nullableObjectOf(variantFields), optional: true },
  { key: 'card', check: nullableObjectOf(variantFields), optional: true },
  { key: 'detail', check: nullableObjectOf(variantFields), optional: true },
  { key: 'hero', check: nullableObjectOf(variantFields), optional: true },
];

export const mediaVariants: Check = objectOf(variantsFields);

const mediaAssetFields: readonly Field[] = [
  { key: 'id', check: gridViewId },
  { key: 'entityType', check: enumOf(MEDIA_ENTITY_TYPES) },
  { key: 'entityId', check: nullable(str) },
  { key: 'category', check: enumOf(MEDIA_CATEGORIES) },
  { key: 'format', check: enumOf(MEDIA_FORMATS) },
  { key: 'variants', check: mediaVariants },
  { key: 'aspectRatio', check: nullable(num) },
  { key: 'version', check: str },
  { key: 'attribution', check: nullable(str) },
  { key: 'license', check: nullable(str) },
  { key: 'fallbackCategory', check: nullable(str) },
];

export const mediaAsset: Check = objectOf(mediaAssetFields);
