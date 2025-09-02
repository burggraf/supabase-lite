import { BaseRepository } from '../BaseRepository'

export interface Supplier {
  supplier_id: number
  company_name: string
  contact_name?: string
  contact_title?: string
  address?: string
  city?: string
  region?: string
  postal_code?: string
  country?: string
  phone?: string
  fax?: string
  home_page?: string
}

export class SupplierRepository extends BaseRepository<Supplier> {
  constructor() {
    super('suppliers', 'supplier_id')
  }
}