'use client';

import * as React from 'react';
import {
  Badge,
  Button,
  DataTable,
  Select,
  TextField,
  tokens,
} from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import {
  assignShift,
  createShift,
  pushBiometricEvent,
  reconcileBiometricEvents,
  registerBiometricDevice,
} from './actions';

interface Shift {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

interface Device {
  id: string;
  name: string;
  location?: string | null;
  deviceIdentifier: string;
  isActive: boolean;
}

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
}

interface RosterRow {
  id: string;
  date: string;
  shift: Shift;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface Props {
  entityId: string;
  employees: Employee[];
  shifts: Shift[];
  devices: Device[];
  roster: RosterRow[];
  from: string;
  to: string;
}

type MessageState = {
  error: string | null;
  success: string | null;
};

function Message({ state }: { state: MessageState }) {
  if (!state.error && !state.success) return null;

  return (
    <div
      style={{
        marginTop: tokens.space(3),
        fontFamily: tokens.font.body,
        fontSize: '13px',
        color: state.error
          ? tokens.color.negative
          : tokens.color.positive,
      }}
    >
      {state.error ?? state.success}
    </div>
  );
}

export function AttendanceManagementPanel({
  entityId,
  employees,
  shifts,
  devices,
  roster,
  from,
  to,
}: Props) {
  const employeeOptions: SelectOption[] = employees.map((employee) => ({
    value: employee.id,
    label: `${employee.employeeCode} — ${employee.firstName} ${employee.lastName}`,
  }));

  const shiftOptions: SelectOption[] = shifts.map((shift) => ({
    value: shift.id,
    label: `${shift.code} — ${shift.name} (${shift.startTime}-${shift.endTime})`,
  }));

  const deviceOptions: SelectOption[] = devices.map((device) => ({
    value: device.id,
    label: `${device.name} — ${device.deviceIdentifier}`,
  }));

  const [shiftCode, setShiftCode] = React.useState('');
  const [shiftName, setShiftName] = React.useState('');
  const [shiftStart, setShiftStart] = React.useState('08:00');
  const [shiftEnd, setShiftEnd] = React.useState('17:00');
  const [breakMinutes, setBreakMinutes] = React.useState('60');
  const [shiftPending, setShiftPending] = React.useState(false);
  const [shiftMessage, setShiftMessage] = React.useState<MessageState>({
    error: null,
    success: null,
  });

  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState(
    employeeOptions[0]?.value ?? '',
  );
  const [selectedShiftId, setSelectedShiftId] = React.useState(
    shiftOptions[0]?.value ?? '',
  );
  const [rosterDate, setRosterDate] = React.useState(
    new Date().toISOString().slice(0, 10),
  );
  const [rosterPending, setRosterPending] = React.useState(false);
  const [rosterMessage, setRosterMessage] = React.useState<MessageState>({
    error: null,
    success: null,
  });

  const [deviceName, setDeviceName] = React.useState('');
  const [deviceLocation, setDeviceLocation] = React.useState('');
  const [deviceIdentifier, setDeviceIdentifier] = React.useState('');
  const [devicePending, setDevicePending] = React.useState(false);
  const [deviceMessage, setDeviceMessage] = React.useState<MessageState>({
    error: null,
    success: null,
  });

  const [eventDeviceId, setEventDeviceId] = React.useState(
    deviceOptions[0]?.value ?? '',
  );
  const [rawEmployeeCode, setRawEmployeeCode] = React.useState(
    employees[0]?.employeeCode ?? '',
  );
  const [eventType, setEventType] = React.useState<'CLOCK_IN' | 'CLOCK_OUT'>(
    'CLOCK_IN',
  );
  const [eventTime, setEventTime] = React.useState(() => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  });
  const [eventPending, setEventPending] = React.useState(false);
  const [eventMessage, setEventMessage] = React.useState<MessageState>({
    error: null,
    success: null,
  });

  const [reconcilePending, setReconcilePending] = React.useState(false);
  const [reconcileMessage, setReconcileMessage] =
    React.useState<MessageState>({
      error: null,
      success: null,
    });

  async function submitShift(event: React.FormEvent) {
    event.preventDefault();

    if (!shiftCode.trim() || !shiftName.trim()) {
      setShiftMessage({
        error: 'Shift code and name are required.',
        success: null,
      });
      return;
    }

    setShiftPending(true);
    setShiftMessage({ error: null, success: null });

    const result = await createShift({
      entityId,
      code: shiftCode.trim(),
      name: shiftName.trim(),
      startTime: shiftStart,
      endTime: shiftEnd,
      breakMinutes: Number(breakMinutes || 0),
    });

    setShiftPending(false);

    if (!result.ok) {
      setShiftMessage({ error: result.error, success: null });
      return;
    }

    setShiftCode('');
    setShiftName('');
    setShiftMessage({
      error: null,
      success: 'Shift created. Refresh the page to use it in the roster.',
    });
  }

  async function submitRoster(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedEmployeeId || !selectedShiftId || !rosterDate) {
      setRosterMessage({
        error: 'Employee, shift and roster date are required.',
        success: null,
      });
      return;
    }

    setRosterPending(true);
    setRosterMessage({ error: null, success: null });

    const result = await assignShift({
      employeeId: selectedEmployeeId,
      shiftId: selectedShiftId,
      date: rosterDate,
    });

    setRosterPending(false);

    if (!result.ok) {
      setRosterMessage({ error: result.error, success: null });
      return;
    }

    setRosterMessage({
      error: null,
      success: 'Roster assignment saved.',
    });
  }

  async function submitDevice(event: React.FormEvent) {
    event.preventDefault();

    if (!deviceName.trim() || !deviceIdentifier.trim()) {
      setDeviceMessage({
        error: 'Device name and identifier are required.',
        success: null,
      });
      return;
    }

    setDevicePending(true);
    setDeviceMessage({ error: null, success: null });

    const result = await registerBiometricDevice({
      entityId,
      name: deviceName.trim(),
      location: deviceLocation.trim() || undefined,
      deviceIdentifier: deviceIdentifier.trim(),
    });

    setDevicePending(false);

    if (!result.ok) {
      setDeviceMessage({ error: result.error, success: null });
      return;
    }

    setDeviceName('');
    setDeviceLocation('');
    setDeviceIdentifier('');
    setDeviceMessage({
      error: null,
      success: 'Biometric device registered.',
    });
  }

  async function submitEvent(event: React.FormEvent) {
    event.preventDefault();

    if (!eventDeviceId || !rawEmployeeCode.trim() || !eventTime) {
      setEventMessage({
        error: 'Device, employee code and event time are required.',
        success: null,
      });
      return;
    }

    setEventPending(true);
    setEventMessage({ error: null, success: null });

    const result = await pushBiometricEvent({
      deviceId: eventDeviceId,
      rawEmployeeCode: rawEmployeeCode.trim(),
      eventType,
      eventTime: new Date(eventTime).toISOString(),
    });

    setEventPending(false);

    if (!result.ok) {
      setEventMessage({ error: result.error, success: null });
      return;
    }

    setEventMessage({
      error: null,
      success: 'Biometric event recorded for reconciliation.',
    });
  }

  async function reconcile() {
    setReconcilePending(true);
    setReconcileMessage({ error: null, success: null });

    const result = await reconcileBiometricEvents(entityId);

    setReconcilePending(false);

    if (!result.ok) {
      setReconcileMessage({ error: result.error, success: null });
      return;
    }

    const payload = result.data as
      | { reconciled?: number; unmatched?: number }
      | undefined;

    setReconcileMessage({
      error: null,
      success:
        payload && typeof payload.reconciled === 'number'
          ? `Reconciled ${payload.reconciled}; ${payload.unmatched ?? 0} unmatched.`
          : 'Biometric reconciliation completed.',
    });
  }

  const sectionStyle: React.CSSProperties = {
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.md,
    padding: tokens.space(4),
    marginBottom: tokens.space(6),
  };

  const formStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: tokens.space(3),
    alignItems: 'end',
  };

  return (
    <>
      <section style={sectionStyle}>
        <h2
          style={{
            margin: `0 0 ${tokens.space(4)}`,
            fontFamily: tokens.font.body,
            fontSize: '16px',
            color: tokens.color.textPrimary,
          }}
        >
          Shifts
        </h2>

        <form onSubmit={submitShift} style={formStyle}>
          <TextField
            label="Code"
            value={shiftCode}
            onChange={(event) => setShiftCode(event.target.value)}
            required
          />
          <TextField
            label="Name"
            value={shiftName}
            onChange={(event) => setShiftName(event.target.value)}
            required
          />
          <TextField
            label="Start"
            type="time"
            value={shiftStart}
            onChange={(event) => setShiftStart(event.target.value)}
            required
          />
          <TextField
            label="End"
            type="time"
            value={shiftEnd}
            onChange={(event) => setShiftEnd(event.target.value)}
            required
          />
          <TextField
            label="Break minutes"
            type="number"
            value={breakMinutes}
            onChange={(event) => setBreakMinutes(event.target.value)}
          />
          <Button type="submit" disabled={shiftPending}>
            {shiftPending ? 'Creating…' : 'Create shift'}
          </Button>
        </form>

        <Message state={shiftMessage} />

        <div style={{ marginTop: tokens.space(6) }}>
          <DataTable
            columns={[
              { header: 'Code', render: (row: Shift) => row.code },
              { header: 'Name', render: (row: Shift) => row.name },
              { header: 'Start', render: (row: Shift) => row.startTime },
              { header: 'End', render: (row: Shift) => row.endTime },
              {
                header: 'Break',
                render: (row: Shift) => `${row.breakMinutes} min`,
              },
            ]}
            rows={shifts}
            keyOf={(row) => row.id}
            emptyMessage="No shifts configured for this entity."
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2
          style={{
            margin: `0 0 ${tokens.space(4)}`,
            fontFamily: tokens.font.body,
            fontSize: '16px',
            color: tokens.color.textPrimary,
          }}
        >
          Shift roster
        </h2>

        <form onSubmit={submitRoster} style={formStyle}>
          <Select
            label="Employee"
            value={selectedEmployeeId}
            onChange={(event) => setSelectedEmployeeId(event.target.value)}
            options={employeeOptions}
            placeholder="Select employee"
          />
          <Select
            label="Shift"
            value={selectedShiftId}
            onChange={(event) => setSelectedShiftId(event.target.value)}
            options={shiftOptions}
            placeholder="Select shift"
          />
          <TextField
            label="Date"
            type="date"
            value={rosterDate}
            onChange={(event) => setRosterDate(event.target.value)}
          />
          <Button type="submit" disabled={rosterPending}>
            {rosterPending ? 'Saving…' : 'Assign shift'}
          </Button>
        </form>

        <Message state={rosterMessage} />

        <div style={{ marginTop: tokens.space(6) }}>
          <div
            style={{
              marginBottom: tokens.space(3),
              fontFamily: tokens.font.body,
              fontSize: '13px',
              color: tokens.color.textMuted,
            }}
          >
            Showing {from} through {to}
          </div>

          <DataTable
            columns={[
              {
                header: 'Date',
                render: (row: RosterRow) =>
                  new Date(row.date).toLocaleDateString(),
              },
              {
                header: 'Employee',
                render: (row: RosterRow) =>
                  `${row.employee.firstName} ${row.employee.lastName}`,
              },
              {
                header: 'Shift',
                render: (row: RosterRow) =>
                  `${row.shift.code} — ${row.shift.name}`,
              },
              {
                header: 'Hours',
                render: (row: RosterRow) =>
                  `${row.shift.startTime} - ${row.shift.endTime}`,
              },
            ]}
            rows={roster}
            keyOf={(row) => row.id}
            emptyMessage="No roster assignments in this date range."
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2
          style={{
            margin: `0 0 ${tokens.space(4)}`,
            fontFamily: tokens.font.body,
            fontSize: '16px',
            color: tokens.color.textPrimary,
          }}
        >
          Biometric devices
        </h2>

        <form onSubmit={submitDevice} style={formStyle}>
          <TextField
            label="Device name"
            value={deviceName}
            onChange={(event) => setDeviceName(event.target.value)}
            required
          />
          <TextField
            label="Location"
            value={deviceLocation}
            onChange={(event) => setDeviceLocation(event.target.value)}
          />
          <TextField
            label="Device identifier"
            value={deviceIdentifier}
            onChange={(event) => setDeviceIdentifier(event.target.value)}
            required
          />
          <Button type="submit" disabled={devicePending}>
            {devicePending ? 'Registering…' : 'Register device'}
          </Button>
        </form>

        <Message state={deviceMessage} />

        <div style={{ marginTop: tokens.space(6) }}>
          <DataTable
            columns={[
              { header: 'Name', render: (row: Device) => row.name },
              {
                header: 'Identifier',
                render: (row: Device) => row.deviceIdentifier,
              },
              {
                header: 'Location',
                render: (row: Device) => row.location ?? '—',
              },
              {
                header: 'Status',
                render: (row: Device) => (
                  <Badge tone={row.isActive ? 'positive' : 'negative'}>
                    {row.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>
                ),
              },
            ]}
            rows={devices}
            keyOf={(row) => row.id}
            emptyMessage="No biometric devices registered."
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2
          style={{
            margin: `0 0 ${tokens.space(4)}`,
            fontFamily: tokens.font.body,
            fontSize: '16px',
            color: tokens.color.textPrimary,
          }}
        >
          Biometric event intake
        </h2>

        <form onSubmit={submitEvent} style={formStyle}>
          <Select
            label="Device"
            value={eventDeviceId}
            onChange={(event) => setEventDeviceId(event.target.value)}
            options={deviceOptions}
            placeholder="Select device"
          />
          <TextField
            label="Raw employee code"
            value={rawEmployeeCode}
            onChange={(event) => setRawEmployeeCode(event.target.value)}
            required
          />
          <Select
            label="Event type"
            value={eventType}
            onChange={(event) =>
              setEventType(event.target.value as 'CLOCK_IN' | 'CLOCK_OUT')
            }
            options={[
              { value: 'CLOCK_IN', label: 'Clock in' },
              { value: 'CLOCK_OUT', label: 'Clock out' },
            ]}
          />
          <TextField
            label="Event time"
            type="datetime-local"
            value={eventTime}
            onChange={(event) => setEventTime(event.target.value)}
            required
          />
          <Button type="submit" disabled={eventPending}>
            {eventPending ? 'Recording…' : 'Record event'}
          </Button>
        </form>

        <Message state={eventMessage} />

        <div style={{ marginTop: tokens.space(4) }}>
          <Button
            type="button"
            variant="secondary"
            onClick={reconcile}
            disabled={reconcilePending}
          >
            {reconcilePending
              ? 'Reconciling…'
              : 'Reconcile biometric events'}
          </Button>
          <Message state={reconcileMessage} />
        </div>
      </section>
    </>
  );
}
