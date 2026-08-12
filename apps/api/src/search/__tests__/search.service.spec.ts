import { Test } from '@nestjs/testing';
import { PERMISSIONS } from '@7f/config';
import { SearchService } from '../search.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SearchService', () => {
  let service: SearchService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      customer: { findMany: jest.fn().mockResolvedValue([]) },
      vendor: { findMany: jest.fn().mockResolvedValue([]) },
      employee: { findMany: jest.fn().mockResolvedValue([]) },
      project: { findMany: jest.fn().mockResolvedValue([]) },
      account: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [SearchService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(SearchService);
  });

  it('returns every category empty for a query shorter than 2 characters, without querying the database', async () => {
    const result = await service.search('a', 'e1', Object.values(PERMISSIONS));
    expect(result.categories.customers).toEqual([]);
    expect(result.categories.vendors).toEqual([]);
    expect(result.categories.employees).toEqual([]);
    expect(result.categories.projects).toEqual([]);
    expect(result.categories.accounts).toEqual([]);
    expect(prisma.customer.findMany).not.toHaveBeenCalled();
  });

  it('skips a category entirely when the caller lacks that category\'s own view permission', async () => {
    prisma.customer.findMany.mockResolvedValue([
      { id: 'c1', name: 'Acme Ltd', code: 'CUST-001', email: 'billing@acme.test' },
    ]);
    const result = await service.search('acme', 'e1', []); // no permissions at all
    expect(result.categories.customers).toEqual([]);
    expect(prisma.customer.findMany).not.toHaveBeenCalled();
  });

  it('includes a category when the caller holds its view permission, mapped to a SearchResultItem', async () => {
    prisma.customer.findMany.mockResolvedValue([
      { id: 'c1', name: 'Acme Ltd', code: 'CUST-001', email: 'billing@acme.test' },
    ]);
    const result = await service.search('acme', 'e1', [PERMISSIONS.AR_VIEW]);
    expect(result.categories.customers).toEqual([
      { id: 'c1', type: 'customer', title: 'Acme Ltd', subtitle: 'CUST-001', href: '/real-estate?customerId=c1' },
    ]);
  });

  it('does not query employees or projects when no entityId is supplied, even with permission', async () => {
    const result = await service.search('acme', '', [PERMISSIONS.HR_VIEW, PERMISSIONS.PMO_VIEW]);
    expect(result.categories.employees).toEqual([]);
    expect(result.categories.projects).toEqual([]);
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
    expect(prisma.project.findMany).not.toHaveBeenCalled();
  });

  it('scopes the employee query by the supplied entityId', async () => {
    prisma.employee.findMany.mockResolvedValue([]);
    await service.search('jane', 'e1', [PERMISSIONS.HR_VIEW]);
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ entityId: 'e1' }) }),
    );
  });

  it('trims the query before checking its length', async () => {
    const result = await service.search('  a  ', 'e1', Object.values(PERMISSIONS));
    expect(result.query).toBe('a');
    expect(result.categories.customers).toEqual([]);
  });
});
