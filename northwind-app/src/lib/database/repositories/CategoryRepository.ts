import { BaseRepository } from '../BaseRepository'

export interface Category {
  category_id: number
  category_name: string
  description?: string
  picture?: string
}

export class CategoryRepository extends BaseRepository<Category> {
  constructor() {
    super('categories', 'category_id')
  }
}