import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

export class HealthResponseDto {
  status = 'ok' as const;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({
    description: 'The API process is running.',
    type: HealthResponseDto,
  })
  getHealth(): HealthResponseDto {
    return { status: 'ok' };
  }
}
