import { Injectable } from '@nestjs/common';
import { TasksProviderRegistry } from './tasks-provider.registry';
import { CreateTaskDto, UpdateTaskDto, DeleteTaskDto } from './dto/task.dto';

/**
 * Release IG.1, Checkpoint M.
 *
 * The piece TasksProviderRegistry and MicrosoftGraphTasksProvider were
 * missing: something that actually calls createTask/updateTask/deleteTask.
 * Mirrors ContactsService exactly, including its scope decision: no
 * Prisma persistence, and no opinion on which of this codebase's
 * task-like records (PMO action items? recruitment follow-ups? HSE
 * corrective actions?) should sync as a Microsoft To Do task —
 * tasks-provider.interface.ts's own design notes explicitly defer that
 * decision to whichever future caller needs it. This layer only makes
 * create/update/delete callable at all.
 *
 * dueDateTime arrives as an ISO string (DTO validation) and is converted
 * to a real Date here before reaching TasksProvider — the same
 * string-to-Date boundary CalendarService draws for its own
 * startTime/endTime, so TaskParams/CreateEventParams can both keep real
 * Date objects in their own interfaces (see tasks-provider.interface.ts's
 * own design notes on this) without every controller-facing DTO needing
 * a custom Date-typed validator.
 */
@Injectable()
export class TasksService {
  constructor(private readonly registry: TasksProviderRegistry) {}

  createTask(dto: CreateTaskDto) {
    const { providerCode, dueDateTime, ...rest } = dto;
    return this.registry.get(providerCode).createTask({
      ...rest,
      dueDateTime: dueDateTime ? new Date(dueDateTime) : undefined,
    });
  }

  updateTask(providerTaskId: string, dto: UpdateTaskDto) {
    const { providerCode, dueDateTime, ...rest } = dto;
    return this.registry.get(providerCode).updateTask({
      ...rest,
      dueDateTime: dueDateTime ? new Date(dueDateTime) : undefined,
      providerTaskId,
    });
  }

  deleteTask(providerTaskId: string, dto: DeleteTaskDto) {
    return this.registry.get(dto.providerCode).deleteTask({ providerTaskId, listId: dto.listId });
  }
}
