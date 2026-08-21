import Link from 'next/link';
import { getWarehouse, updateWarehouseFromForm } from '../../actions';

export default async function WarehouseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await getWarehouse(params.id);
  const warehouse = data?.warehouse;
  const balances = data?.balances ?? [];
  const movements = data?.movements ?? [];

  if (!warehouse) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Warehouse not found</h1>
        <Link href="/inventory">Back to Inventory</Link>
      </main>
    );
  }

  const totalUnits = balances.reduce(
    (sum: number, row: any) => sum + Number(row.quantityOnHand ?? 0),
    0,
  );

  const totalValue = balances.reduce(
    (sum: number, row: any) =>
      sum + Number(row.quantityOnHand ?? 0) * Number(row.averageUnitCost ?? 0),
    0,
  );

  const updateAction = updateWarehouseFromForm.bind(null, warehouse.id);

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <p>
        <Link href="/inventory">← Inventory</Link>
      </p>

      <header style={{ marginBottom: 24 }}>
        <h1>{warehouse.name}</h1>
        <p>
          {warehouse.code} · {warehouse.isActive ? 'Active' : 'Inactive'}
        </p>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <strong>Stock items</strong>
          <div>{balances.length}</div>
        </div>
        <div>
          <strong>Units on hand</strong>
          <div>{totalUnits.toLocaleString()}</div>
        </div>
        <div>
          <strong>Inventory value</strong>
          <div>{totalValue.toLocaleString()}</div>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Warehouse details</h2>

        <form action={updateAction} style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
          <label>
            Code
            <input
              name="code"
              defaultValue={warehouse.code}
              required
              style={{ display: 'block', width: '100%' }}
            />
          </label>

          <label>
            Name
            <input
              name="name"
              defaultValue={warehouse.name}
              required
              style={{ display: 'block', width: '100%' }}
            />
          </label>

          <label>
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={warehouse.isActive}
            />{' '}
            Active
          </label>

          <button type="submit">Save warehouse</button>
        </form>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Stock balances</h2>

        {balances.length === 0 ? (
          <p>No stock currently recorded in this warehouse.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Item</th>
                <th align="left">Name</th>
                <th align="right">On hand</th>
                <th align="right">Average cost</th>
                <th align="right">Value</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((row: any) => {
                const quantity = Number(row.quantityOnHand ?? 0);
                const cost = Number(row.averageUnitCost ?? 0);

                return (
                  <tr key={row.id}>
                    <td>
                      <Link
                        href={`/inventory/stock-items/${row.stockItemId}?entityId=${warehouse.entityId}`}
                      >
                        {row.stockItem?.code ?? row.stockItemId}
                      </Link>
                    </td>
                    <td>{row.stockItem?.name ?? '—'}</td>
                    <td align="right">{quantity.toLocaleString()}</td>
                    <td align="right">{cost.toLocaleString()}</td>
                    <td align="right">
                      {(quantity * cost).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Recent movements</h2>

        {movements.length === 0 ? (
          <p>No movements recorded.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Date</th>
                <th align="left">Item</th>
                <th align="left">Type</th>
                <th align="right">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement: any) => (
                <tr key={movement.id}>
                  <td>
                    {new Date(movement.movementDate).toLocaleDateString()}
                  </td>
                  <td>{movement.stockItem?.code ?? movement.stockItemId}</td>
                  <td>{movement.movementType}</td>
                  <td align="right">
                    {Number(movement.quantity ?? 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
