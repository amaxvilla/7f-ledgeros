import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CreateTaskDto, UpdateTaskDto, DeleteTaskDto } from './dto/task.dto';

/** Release IG.1, Checkpoint M. */
@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a task via the given tasks provider',
    description:
      'A thin call-through to the provider registry -- no Prisma persistence, no opinion on which of this codebase\'s task-like records should sync as a provider task; mirrors ContactsService\'s own same scope decision. dueDateTime, if supplied, is an ISO string converted to a real Date before reaching the provider.',
  })
  @RequirePermissions('tasks.manage')
  create(@Body() dto: CreateTaskDto) {
    return this.tasks.createTask(dto);
  }

  @Post(':providerTaskId')
  @ApiOperation({ summary: 'Update a task via the given tasks provider' })
  @RequirePermissions('tasks.manage')
  update(@Param('providerTaskId') providerTaskId: string, @Body() dto: UpdateTaskDto) {
    return this.tasks.updateTask(providerTaskId, dto);
  }

  @Delete(':providerTaskId')
  @ApiOperation({ summary: 'Delete a task via the given tasks provider' })
  @RequirePermissions('tasks.manage')
  remove(@Param('providerTaskId') providerTaskId: string, @Body() dto: DeleteTaskDto) {
    return this.tasks.deleteTask(providerTaskId, dto);
  }
}
