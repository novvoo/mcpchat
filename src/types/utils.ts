// Utility types for enhanced type safety and convenience

// Make all properties optional
export type Partial<T> = {
  [P in keyof T]?: T[P]
}

// Make all properties required
export type Required<T> = {
  [P in keyof T]-?: T[P]
}

// Pick specific properties from a type
export type Pick<T, K extends keyof T> = {
  [P in K]: T[P]
}

// Omit specific properties from a type
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>

// Create a type with some properties optional
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// Create a type with some properties required
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

// Extract the type of array elements
export type ArrayElement<T> = T extends (infer U)[] ? U : never

// Extract the return type of a function
export type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never

// Extract the parameters of a function
export type Parameters<T> = T extends (...args: infer P) => any ? P : never

// Create a type that represents a promise result
export type PromiseResult<T> = T extends Promise<infer U> ? U : T

// Create a type for API response wrapper
export type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: import('./index').ErrorResponse
}

// Create a type for async operation state
export type AsyncState<T> = {
  data?: T
  loading: boolean
  error?: string
}

// Create a type for form field state
export type FieldState<T> = {
  value: T
  error?: string
  touched: boolean
  dirty: boolean
}

// Create a type for pagination
export type Pagination = {
  page: number
  limit: number
  total: number
  hasNext: boolean
  hasPrev: boolean
}

// Create a type for sorting
export type Sort<T> = {
  field: keyof T
  direction: 'asc' | 'desc'
}

// Create a type for filters
export type Filter<T> = {
  [K in keyof T]?: T[K] | T[K][]
}

// Create a type for search parameters
export type SearchParams<T> = {
  query?: string
  filters?: Filter<T>
  sort?: Sort<T>
  pagination?: Pagination
}

// Utility type for creating update payloads (excludes common entity fields)
export type UpdatePayload<T> = Partial<T>

// Utility type for creating new entity payloads (excludes common entity fields)
export type CreatePayload<T> = T

// Utility type for database entities
export type Entity<T> = T & {
  id: string
  createdAt: Date
  updatedAt: Date
}

// Utility type for configuration objects
export type Config<T> = {
  readonly [K in keyof T]: T[K]
}

// Utility type for event handlers
export type EventHandler<T = void> = (event: T) => void | Promise<void>

// Utility type for component refs
export type ComponentRef<T> = React.RefObject<T> | ((instance: T | null) => void)

// Utility type for theme configuration
export type Theme = {
  colors: {
    primary: string
    secondary: string
    background: string
    surface: string
    text: string
    error: string
    warning: string
    success: string
  }
  spacing: {
    xs: string
    sm: string
    md: string
    lg: string
    xl: string
  }
  typography: {
    fontFamily: string
    fontSize: {
      xs: string
      sm: string
      md: string
      lg: string
      xl: string
    }
  }
}

// Utility type for responsive breakpoints
export type Breakpoints = {
  xs: string
  sm: string
  md: string
  lg: string
  xl: string
}

// Utility type for animation configuration
export type Animation = {
  duration: number
  easing: string
  delay?: number
}

// Utility type for keyboard shortcuts
export type KeyboardShortcut = {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  handler: EventHandler<KeyboardEvent>
}