import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ErrorCode } from '../helpers/http-response.helper';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'] as string;
    const expectedApiKey = this.configService.get<string>('license.apiKey');

    if (!apiKey || apiKey !== expectedApiKey) {
      throw new UnauthorizedException({
        message: 'Invalid or missing API key',
        code: ErrorCode.UNAUTHORIZED,
      });
    }

    return true;
  }
}
