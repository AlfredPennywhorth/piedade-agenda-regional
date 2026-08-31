import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App — S00 Scaffolding', () => {
  it('renderiza o nome da aplicação', () => {
    render(<App />)
    expect(screen.getByRole('main')).toBeDefined()
    expect(screen.getByText('Agenda Regional São Paulo')).toBeDefined()
  })

  it('exibe indicador de sprint S00', () => {
    render(<App />)
    expect(screen.getByText(/Sprint S00/i)).toBeDefined()
  })
})
