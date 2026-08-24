import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ErrorCode, type ErrorCodeValue } from './error-codes';

/**
 * The single error envelope every failing endpoint returns, per Stage 1 plan
 * section 2: `{ code, message, fieldErrors? }`.
 */
export class ErrorResponseDto {
  @ApiProperty({
    description: 'Stable machine-readable error code.',
    enum: Object.values(ErrorCode),
    example: ErrorCode.VALIDATION_FAILED,
  })
  code!: ErrorCodeValue;

  @ApiProperty({
    description: 'Human-readable message safe to display to the end user.',
    example: 'Fix the highlighted fields to continue.',
  })
  message!: string;

  @ApiPropertyOptional({
    description:
      'Field-scoped messages keyed by request-body field name. Present only ' +
      'when the failure can be safely attributed to specific fields.',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { username: 'This username is already taken.' },
  })
  fieldErrors?: Record<string, string>;
}
