import { SetMetadata } from '@nestjs/common';
import { SensitiveFieldGroup } from '../security.types';

export const MASK_FIELDS_KEY = 'maskFields';

export interface MaskFieldsSpec {
  /** Which sensitive field group this permission gates (see SENSITIVE_FIELD_GROUPS). */
  group: SensitiveFieldGroup;
  /** Field names (object keys) belonging to that group, matched at any depth
   *  in the response body — including inside arrays and nested objects. */
  fields: string[];
}

/**
 * Declares that a route's JSON response may contain sensitive fields that
 * must be masked unless the caller holds the corresponding
 * `security.field.*.view` permission. Read by FieldMaskingInterceptor.
 *
 * Example:
 *   @MaskFields(
 *     { group: 'salary', fields: ['baseSalary', 'grossPay', 'annualSalary'] },
 *     { group: 'bankDetails', fields: ['bankAccountNumber', 'iban', 'swiftCode'] },
 *   )
 *   @Get(':id')
 *   findOne(...) { ... }
 */
export const MaskFields = (...specs: MaskFieldsSpec[]) => SetMetadata(MASK_FIELDS_KEY, specs);
