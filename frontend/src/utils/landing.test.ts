import { describe, expect, it } from 'vitest'

import type { Branch } from '../types/branch'

import {
  activeBranchNames,
  branchesHighlight,
  heroStockLabel,
  inventoryTagline,
  landingBranchName,
} from './landing'

function branch(name: string, active = true): Branch {
  return { id: name, name, address: 'Calle', phone: '1', active }
}

const branches = [
  branch('Sede Makro'),
  branch('Intelligent Nutrition - Viva'),
  branch('Sede Sogamoso'),
  branch('Sede Cerrada', false),
]

describe('landing utils', () => {
  it('shortens the branch names', () => {
    expect(landingBranchName('Intelligent Nutrition - Bogotá')).toBe('Bogotá')
    expect(landingBranchName('Sede Makro')).toBe('Makro')
  })

  it('counts and names only the active branches', () => {
    expect(branchesHighlight('success', branches)).toEqual({
      title: '3 sedes',
      description: 'Makro, Viva y Sogamoso',
    })
    expect(branchesHighlight('success', [branch('Sede Makro')])).toEqual({
      title: '1 sede',
      description: 'Makro',
    })
    expect(heroStockLabel('success', branches)).toBe('3 sedes, un solo stock')
  })

  it('uses a neutral text while loading, on error or without active branches', () => {
    expect(branchesHighlight('loading', []).title).toBe('Sedes físicas')
    expect(branchesHighlight('success', [branch('Sede Cerrada', false)]).title).toBe(
      'Sedes físicas',
    )
    expect(heroStockLabel('error', [])).toBe('Todas las sedes, un solo stock')
  })

  it('writes the inventory tagline of the login with the real branches', () => {
    expect(inventoryTagline('success', branches)).toBe(
      'Un solo inventario para 3 sedes. Lo que ves en pantalla es lo que hay en el estante.',
    )
    expect(inventoryTagline('success', [branch('Sede Makro')])).toMatch(/para una sede\./)
    expect(inventoryTagline('loading', [])).toMatch(/para todas las sedes\./)
    expect(activeBranchNames(branches)).toBe('Makro, Viva y Sogamoso')
  })
})
