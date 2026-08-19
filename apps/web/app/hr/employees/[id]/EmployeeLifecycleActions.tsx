'use client';

import * as React from 'react';
import { Button, TextField, tokens } from '@7f/ui';
import {
  addEmployeeDocument,
  addEmployeeNextOfKin,
  addEmployeeEmergencyContact,
  assignEmployeeAsset,
  returnEmployeeAsset,
  raiseEmployeeDisciplinaryCase,
  closeEmployeeDisciplinaryCase,
} from '../actions';

type Result = { ok: boolean; error?: string };

function Message({
  error,
  success,
}: {
  error: string | null;
  success: string | null;
}) {
  if (!error && !success) return null;

  return (
    <div
      style={{
        marginTop: tokens.space(2),
        fontFamily: tokens.font.body,
        fontSize: '13px',
        color: error ? tokens.color.negative : tokens.color.positive,
      }}
    >
      {error ?? success}
    </div>
  );
}

export function EmployeeLifecycleActions({
  employeeId,
}: {
  employeeId: string;
}) {
  const [documentType, setDocumentType] = React.useState('');
  const [documentUrl, setDocumentUrl] = React.useState('');
  const [documentDescription, setDocumentDescription] = React.useState('');
  const [documentPending, setDocumentPending] = React.useState(false);
  const [documentMessage, setDocumentMessage] = React.useState<string | null>(null);
  const [documentError, setDocumentError] = React.useState<string | null>(null);

  const [kinName, setKinName] = React.useState('');
  const [kinRelationship, setKinRelationship] = React.useState('');
  const [kinPhone, setKinPhone] = React.useState('');
  const [kinAddress, setKinAddress] = React.useState('');
  const [kinPending, setKinPending] = React.useState(false);
  const [kinMessage, setKinMessage] = React.useState<string | null>(null);
  const [kinError, setKinError] = React.useState<string | null>(null);

  const [contactName, setContactName] = React.useState('');
  const [contactRelationship, setContactRelationship] = React.useState('');
  const [contactPhone, setContactPhone] = React.useState('');
  const [contactPending, setContactPending] = React.useState(false);
  const [contactMessage, setContactMessage] = React.useState<string | null>(null);
  const [contactError, setContactError] = React.useState<string | null>(null);

  const [assetName, setAssetName] = React.useState('');
  const [assetTag, setAssetTag] = React.useState('');
  const [assetDescription, setAssetDescription] = React.useState('');
  const [assetPending, setAssetPending] = React.useState(false);
  const [assetMessage, setAssetMessage] = React.useState<string | null>(null);
  const [assetError, setAssetError] = React.useState<string | null>(null);

  const [caseType, setCaseType] = React.useState('WARNING');
  const [caseDescription, setCaseDescription] = React.useState('');
  const [disciplinaryPending, setDisciplinaryPending] = React.useState(false);
  const [disciplinaryMessage, setDisciplinaryMessage] = React.useState<string | null>(null);
  const [disciplinaryError, setDisciplinaryError] = React.useState<string | null>(null);

  async function submitDocument(event: React.FormEvent) {
    event.preventDefault();

    if (!documentType.trim() || !documentUrl.trim()) {
      setDocumentError('Document type and file URL are required.');
      return;
    }

    setDocumentPending(true);
    setDocumentError(null);
    setDocumentMessage(null);

    const result: Result = await addEmployeeDocument({
      employeeId,
      documentType: documentType.trim(),
      fileUrl: documentUrl.trim(),
      description: documentDescription.trim() || undefined,
    });

    setDocumentPending(false);

    if (!result.ok) {
      setDocumentError(result.error ?? 'Failed to add document.');
      return;
    }

    setDocumentType('');
    setDocumentUrl('');
    setDocumentDescription('');
    setDocumentMessage('Document added.');
  }

  async function submitNextOfKin(event: React.FormEvent) {
    event.preventDefault();

    if (!kinName.trim() || !kinRelationship.trim() || !kinPhone.trim()) {
      setKinError('Name, relationship and phone are required.');
      return;
    }

    setKinPending(true);
    setKinError(null);
    setKinMessage(null);

    const result: Result = await addEmployeeNextOfKin({
      employeeId,
      name: kinName.trim(),
      relationship: kinRelationship.trim(),
      phone: kinPhone.trim(),
      address: kinAddress.trim() || undefined,
    });

    setKinPending(false);

    if (!result.ok) {
      setKinError(result.error ?? 'Failed to add next of kin.');
      return;
    }

    setKinName('');
    setKinRelationship('');
    setKinPhone('');
    setKinAddress('');
    setKinMessage('Next of kin recorded.');
  }

  async function submitEmergencyContact(event: React.FormEvent) {
    event.preventDefault();

    if (!contactName.trim() || !contactRelationship.trim() || !contactPhone.trim()) {
      setContactError('Name, relationship and phone are required.');
      return;
    }

    setContactPending(true);
    setContactError(null);
    setContactMessage(null);

    const result: Result = await addEmployeeEmergencyContact({
      employeeId,
      name: contactName.trim(),
      relationship: contactRelationship.trim(),
      phone: contactPhone.trim(),
    });

    setContactPending(false);

    if (!result.ok) {
      setContactError(result.error ?? 'Failed to add emergency contact.');
      return;
    }

    setContactName('');
    setContactRelationship('');
    setContactPhone('');
    setContactMessage('Emergency contact recorded.');
  }

  async function submitAsset(event: React.FormEvent) {
    event.preventDefault();

    if (!assetName.trim()) {
      setAssetError('Asset name is required.');
      return;
    }

    setAssetPending(true);
    setAssetError(null);
    setAssetMessage(null);

    const result: Result = await assignEmployeeAsset({
      employeeId,
      assetName: assetName.trim(),
      assetTag: assetTag.trim() || undefined,
      description: assetDescription.trim() || undefined,
    });

    setAssetPending(false);

    if (!result.ok) {
      setAssetError(result.error ?? 'Failed to assign asset.');
      return;
    }

    setAssetName('');
    setAssetTag('');
    setAssetDescription('');
    setAssetMessage('Asset assigned.');
  }

  async function submitDisciplinary(event: React.FormEvent) {
    event.preventDefault();

    if (!caseDescription.trim()) {
      setDisciplinaryError('Case description is required.');
      return;
    }

    setDisciplinaryPending(true);
    setDisciplinaryError(null);
    setDisciplinaryMessage(null);

    const result: Result = await raiseEmployeeDisciplinaryCase({
      employeeId,
      caseType,
      description: caseDescription.trim(),
    });

    setDisciplinaryPending(false);

    if (!result.ok) {
      setDisciplinaryError(result.error ?? 'Failed to raise disciplinary case.');
      return;
    }

    setCaseDescription('');
    setDisciplinaryMessage('Disciplinary case raised.');
  }

  const cardStyle: React.CSSProperties = {
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.md,
    padding: tokens.space(4),
    marginBottom: tokens.space(4),
  };

  const formStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: tokens.space(3),
    alignItems: 'end',
  };

  return (
    <section style={{ marginBottom: tokens.space(8) }}>
      <PageHeading title="Employee lifecycle" />

      <div style={cardStyle}>
        <PageHeading title="Documents" />
        <form onSubmit={submitDocument} style={formStyle}>
          <TextField
            label="Document type"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            required
          />
          <TextField
            label="File URL"
            value={documentUrl}
            onChange={(e) => setDocumentUrl(e.target.value)}
            required
          />
          <TextField
            label="Description (optional)"
            value={documentDescription}
            onChange={(e) => setDocumentDescription(e.target.value)}
          />
          <Button type="submit" disabled={documentPending}>
            {documentPending ? 'Adding…' : 'Add document'}
          </Button>
        </form>
        <Message error={documentError} success={documentMessage} />
      </div>

      <div style={cardStyle}>
        <PageHeading title="Next of kin" />
        <form onSubmit={submitNextOfKin} style={formStyle}>
          <TextField label="Name" value={kinName} onChange={(e) => setKinName(e.target.value)} required />
          <TextField label="Relationship" value={kinRelationship} onChange={(e) => setKinRelationship(e.target.value)} required />
          <TextField label="Phone" value={kinPhone} onChange={(e) => setKinPhone(e.target.value)} required />
          <TextField label="Address (optional)" value={kinAddress} onChange={(e) => setKinAddress(e.target.value)} />
          <Button type="submit" disabled={kinPending}>
            {kinPending ? 'Saving…' : 'Add next of kin'}
          </Button>
        </form>
        <Message error={kinError} success={kinMessage} />
      </div>

      <div style={cardStyle}>
        <PageHeading title="Emergency contact" />
        <form onSubmit={submitEmergencyContact} style={formStyle}>
          <TextField label="Name" value={contactName} onChange={(e) => setContactName(e.target.value)} required />
          <TextField label="Relationship" value={contactRelationship} onChange={(e) => setContactRelationship(e.target.value)} required />
          <TextField label="Phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required />
          <Button type="submit" disabled={contactPending}>
            {contactPending ? 'Saving…' : 'Add emergency contact'}
          </Button>
        </form>
        <Message error={contactError} success={contactMessage} />
      </div>

      <div style={cardStyle}>
        <PageHeading title="Asset assignment" />
        <form onSubmit={submitAsset} style={formStyle}>
          <TextField label="Asset name" value={assetName} onChange={(e) => setAssetName(e.target.value)} required />
          <TextField label="Asset tag (optional)" value={assetTag} onChange={(e) => setAssetTag(e.target.value)} />
          <TextField label="Description (optional)" value={assetDescription} onChange={(e) => setAssetDescription(e.target.value)} />
          <Button type="submit" disabled={assetPending}>
            {assetPending ? 'Assigning…' : 'Assign asset'}
          </Button>
        </form>
        <Message error={assetError} success={assetMessage} />
      </div>

      <div style={cardStyle}>
        <PageHeading title="Disciplinary case" />
        <form onSubmit={submitDisciplinary} style={formStyle}>
          <TextField
            label="Case type"
            value={caseType}
            onChange={(e) => setCaseType(e.target.value)}
            required
          />
          <TextField
            label="Description"
            value={caseDescription}
            onChange={(e) => setCaseDescription(e.target.value)}
            required
          />
          <Button type="submit" disabled={disciplinaryPending}>
            {disciplinaryPending ? 'Raising…' : 'Raise case'}
          </Button>
        </form>
        <Message error={disciplinaryError} success={disciplinaryMessage} />
      </div>
    </section>
  );
}

function PageHeading({ title }: { title: string }) {
  return (
    <h3
      style={{
        margin: `0 0 ${tokens.space(3)}`,
        fontFamily: tokens.font.body,
        fontSize: '15px',
        fontWeight: 600,
        color: tokens.color.textPrimary,
      }}
    >
      {title}
    </h3>
  );
}

export function ReturnEmployeeAssetButton({
  assignmentId,
  employeeId,
}: {
  assignmentId: string;
  employeeId: string;
}) {
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function handleReturn() {
    setPending(true);
    setMessage(null);

    const condition = window.prompt('Condition on return (optional):') ?? undefined;

    const result = await returnEmployeeAsset(assignmentId, employeeId, condition);

    setPending(false);

    if (!result.ok) {
      setMessage(result.error ?? 'Failed to return asset.');
      return;
    }

    setMessage('Returned.');
  }

  return (
    <div style={{ display: 'flex', gap: tokens.space(2), alignItems: 'center' }}>
      <Button type="button" onClick={handleReturn} disabled={pending} variant="secondary">
        {pending ? 'Returning…' : 'Return asset'}
      </Button>
      {message && (
        <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>
          {message}
        </span>
      )}
    </div>
  );
}

export function CloseEmployeeDisciplinaryCaseButton({
  caseId,
  employeeId,
}: {
  caseId: string;
  employeeId: string;
}) {
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function handleClose() {
    const outcome = window.prompt('Enter the case outcome:');
    if (!outcome?.trim()) return;

    setPending(true);
    setMessage(null);

    const result = await closeEmployeeDisciplinaryCase(
      caseId,
      employeeId,
      outcome.trim(),
    );

    setPending(false);

    if (!result.ok) {
      setMessage(result.error ?? 'Failed to close disciplinary case.');
      return;
    }

    setMessage('Closed.');
  }

  return (
    <div style={{ display: 'flex', gap: tokens.space(2), alignItems: 'center' }}>
      <Button type="button" onClick={handleClose} disabled={pending} variant="secondary">
        {pending ? 'Closing…' : 'Close case'}
      </Button>
      {message && (
        <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>
          {message}
        </span>
      )}
    </div>
  );
}
