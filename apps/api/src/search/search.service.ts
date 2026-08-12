import { Injectable } from '@nestjs/common';
import { PERMISSIONS } from '@7f/config';
import { PrismaService } from '../prisma/prisma.service';

export interface SearchResultItem {
  id: string;
  type: 'customer' | 'vendor' | 'employee' | 'project' | 'account';
  title: string;
  subtitle?: string;
  href: string;
}

export interface SearchResults {
  query: string;
  categories: {
    customers: SearchResultItem[];
    vendors: SearchResultItem[];
    employees: SearchResultItem[];
    projects: SearchResultItem[];
    accounts: SearchResultItem[];
  };
}

const RESULT_LIMIT = 8;

/**
 * FE-1's last named-but-open gap (Search — see CHECKPOINT_REPORT.md's
 * FE-1.6 entry, "Recommended Next Checkpoint"). Genuinely NOT FOUND before
 * this checkpoint: no cross-module query/index surface existed anywhere in
 * this API (confirmed by grepping every `apps/api/src` directory for
 * "search" — the only hits were unrelated per-provider "search" methods on
 * bank/storage/e-signature integrations, not a user-facing search).
 *
 * Deliberately the smallest correct version of "search", not a search
 * engine: five `contains`-filtered Prisma queries (no index, no ranking,
 * no full-text/trigram extension — none of those exist in this schema
 * today, and adding one is a real, separate infrastructure checkpoint of
 * its own) across the five master-data models most useful to look someone
 * up by name/code from anywhere in the app: Customer, Vendor, Employee,
 * Project, and (chart-of-accounts) Account.
 *
 * Permission handling deliberately does NOT gate the whole endpoint behind
 * one new permission the way most other new controllers in this codebase
 * do. Search spans five pre-existing view permissions
 * (ar.view/ap.view/hr.view/pmo.view/coa.view) that are already granted
 * independently per role; requiring all five via `@RequirePermissions`
 * (which is an AND, not an OR — see its own doc comment) would lock out
 * anyone who can't see every one of those five modules, which is most
 * roles in this app's seeded role set. Instead this is self-service (like
 * `GET /dashboard/my-notifications`) and each category is silently
 * skipped when the caller's own token doesn't carry the matching `_VIEW`
 * permission for it, so results never include anything a direct call to
 * that module's own endpoint would have refused the same caller anyway.
 *
 * `Customer`/`Vendor`/`Account` are genuinely global master data in this
 * schema (no `entityId` column on any of the three — confirmed directly
 * against `prisma/schema.prisma` before writing this query rather than
 * assumed), so they are not entity-filtered. `Project`/`Employee` do carry
 * `entityId` and are filtered by the caller-supplied one, the same
 * required-`entityId` convention `DashboardController`'s per-module
 * widgets already use.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    query: string,
    entityId: string,
    permissions: string[],
  ): Promise<SearchResults> {
    const q = query.trim();
    const has = (p: string) => permissions.includes(p);

    const empty: SearchResults = {
      query: q,
      categories: { customers: [], vendors: [], employees: [], projects: [], accounts: [] },
    };
    if (q.length < 2) {
      return empty;
    }

    const [customers, vendors, employees, projects, accounts] = await Promise.all([
      has(PERMISSIONS.AR_VIEW) ? this.searchCustomers(q) : Promise.resolve([]),
      has(PERMISSIONS.AP_VIEW) ? this.searchVendors(q) : Promise.resolve([]),
      has(PERMISSIONS.HR_VIEW) && entityId ? this.searchEmployees(q, entityId) : Promise.resolve([]),
      has(PERMISSIONS.PMO_VIEW) && entityId ? this.searchProjects(q, entityId) : Promise.resolve([]),
      has(PERMISSIONS.COA_VIEW) ? this.searchAccounts(q) : Promise.resolve([]),
    ]);

    return { query: q, categories: { customers, vendors, employees, projects, accounts } };
  }

  private async searchCustomers(q: string): Promise<SearchResultItem[]> {
    const rows = await this.prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: RESULT_LIMIT,
      orderBy: { name: 'asc' },
    });
    return rows.map((c: { id: string; name: string; code: string }) => ({
      id: c.id,
      type: 'customer' as const,
      title: c.name,
      subtitle: c.code,
      href: `/real-estate?customerId=${c.id}`,
    }));
  }

  private async searchVendors(q: string): Promise<SearchResultItem[]> {
    const rows = await this.prisma.vendor.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: RESULT_LIMIT,
      orderBy: { name: 'asc' },
    });
    return rows.map((v: { id: string; name: string; code: string }) => ({
      id: v.id,
      type: 'vendor' as const,
      title: v.name,
      subtitle: v.code,
      href: `/ap-ar?vendorId=${v.id}`,
    }));
  }

  private async searchEmployees(q: string, entityId: string): Promise<SearchResultItem[]> {
    const rows = await this.prisma.employee.findMany({
      where: {
        entityId,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { employeeCode: { contains: q, mode: 'insensitive' } },
          { workEmail: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: RESULT_LIMIT,
      orderBy: { firstName: 'asc' },
    });
    return rows.map((e: { id: string; firstName: string; lastName: string; employeeCode: string }) => ({
      id: e.id,
      type: 'employee' as const,
      title: `${e.firstName} ${e.lastName}`,
      subtitle: e.employeeCode,
      href: `/hr?employeeId=${e.id}`,
    }));
  }

  private async searchProjects(q: string, entityId: string): Promise<SearchResultItem[]> {
    const rows = await this.prisma.project.findMany({
      where: {
        entityId,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: RESULT_LIMIT,
      orderBy: { name: 'asc' },
    });
    return rows.map((p: { id: string; name: string; code: string }) => ({
      id: p.id,
      type: 'project' as const,
      title: p.name,
      subtitle: p.code,
      href: `/real-estate?projectId=${p.id}`,
    }));
  }

  private async searchAccounts(q: string): Promise<SearchResultItem[]> {
    const rows = await this.prisma.account.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: RESULT_LIMIT,
      orderBy: { code: 'asc' },
    });
    return rows.map((a: { id: string; name: string; code: string }) => ({
      id: a.id,
      type: 'account' as const,
      title: a.name,
      subtitle: a.code,
      href: `/general-ledger?accountId=${a.id}`,
    }));
  }
}
