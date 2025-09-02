import { BaseRepository } from '../BaseRepository'

export interface Employee {
  employee_id: number
  last_name: string
  first_name: string
  title?: string
  title_of_courtesy?: string
  birth_date?: Date
  hire_date?: Date
  address?: string
  city?: string
  region?: string
  postal_code?: string
  country?: string
  home_phone?: string
  extension?: string
  photo?: string
  notes?: string
  reports_to?: number
  photo_path?: string
}

export class EmployeeRepository extends BaseRepository<Employee> {
  constructor() {
    super('employees', 'employee_id')
  }
}