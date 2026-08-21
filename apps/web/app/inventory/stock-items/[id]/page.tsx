import Link from 'next/link';
import { getStockItem, updateStockItemFromForm } from '../../actions';

export default async function StockItemDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await getStockItem(params.id);
  const item = data?.stockItem;
  const balances = data?.balances ?? [];
  const movements = data?.movements ?? [];

  if (!item) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Stock item not found</h1>
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

  const updateAction = updateStockItemFromForm.bind(null, item.id);

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <p>
        <Link href="/inventory">← Inventory</Link>
      </p>

      <header style={{ marginBottom: 24 }}>
        <h1>{item.name}</h1>
        <p>
          {item.code} · {item.domain} · {item.unitOfMeasure} ·{' '}
          {item.isActive ? 'Active' : 'Inactive'}
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
          <strong>Warehouses</strong>
          <div>{balances.length}</div>
        </div>
        <div>
          <strong>Total on hand</strong>
          <div>{totalUnits.toLocaleString()}</div>
        </div>
        <div>
          <strong>Total inventory value</strong>
          <div>{totalValue.toLocaleString()}</div>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Stock item details</h2>

        <form action={updateAction} style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
          <label>
            Code
            <input
              name="code"
              defaultValue={item.code}
              required
              style={{ display: 'block', width: '100%' }}
            />
          </label>

          <label>
            Name
            <input
              name="name"
              defaultValue={item.name}
              required
              style={{ display: 'block', width: '100%' }}
            />
          </label>

          <label>
            Domain
            <input
              name="domain"
              defaultValue={item.domain}
              required
              style={{ display: 'block', width: '100%' }}
            />
          </label>

          <label>
            Unit of measure
            <input
              name="unitOfMeasure"
              defaultValue={item.unitOfMeasure}
              required
              style={{ display: 'block', width: '100%' }}
            />
          </label>

          <label>
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={item.isActive}
            />{' '}
            Active
          </label>

          <button type="submit">Save stock item</button>
        </form>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Warehouse balances</h2>

        {balances.length === 0 ? (
          <p>No stock currently held in any warehouse.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Warehouse</th>
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
                        href={`/inventory/warehouses/${row.warehouseId}?entityId=${item.entityId}`}
                      >
                        {row.warehouse?.code ?? row.warehouseId}
                      </Link>
                    </td>
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
                <th align="left">Warehouse</th>
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
                  <td>{movement.warehouse?.code ?? movement.warehouseId}</td>
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
