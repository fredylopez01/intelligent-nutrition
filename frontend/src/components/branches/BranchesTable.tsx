import type { Branch } from '../../types/branch'
import { scheduleStatus } from '../../utils/branchSchedule'
import { StatusBadge } from '../users/StatusBadge'

import { BranchRowActions } from './BranchRowActions'

import './BranchesTable.css'

interface BranchesTableProps {
  branches: Branch[]
  onEdit: (branch: Branch) => void
  onSchedule: (branch: Branch) => void
  onToggleStatus: (branch: Branch) => void
}

export function BranchesTable({
  branches,
  onEdit,
  onSchedule,
  onToggleStatus,
}: BranchesTableProps) {
  const now = new Date()
  return (
    <table className="branches-table">
      <caption className="sr-only">Sedes registradas en Intelligent Nutrition</caption>
      <thead>
        <tr>
          <th scope="col">Nombre</th>
          <th scope="col">Dirección</th>
          <th scope="col">Teléfono</th>
          <th scope="col">Horario</th>
          <th scope="col" className="branches-table__col-status">
            Estado
          </th>
          <th scope="col" className="branches-table__col-actions">
            <span className="sr-only">Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {branches.map((branch) => {
          const schedule = scheduleStatus(branch, now)
          return (
            <tr key={branch.id} className="branches-table__row">
              <td className="branches-table__name">{branch.name}</td>
              <td className="branches-table__cell-muted">{branch.address}</td>
              <td className="branches-table__cell-muted">{branch.phone}</td>
              <td className="branches-table__schedule" title={schedule.label}>
                <span
                  className={`branches-table__dot${schedule.open ? ' branches-table__dot--open' : ''}`}
                  aria-hidden="true"
                />
                {schedule.label}
              </td>
              <td className="branches-table__col-status">
                <StatusBadge status={branch.active ? 'activo' : 'inactivo'} />
              </td>
              <td className="branches-table__col-actions">
                <BranchRowActions
                  branchName={branch.name}
                  active={branch.active}
                  onEdit={() => onEdit(branch)}
                  onSchedule={() => onSchedule(branch)}
                  onToggleStatus={() => onToggleStatus(branch)}
                />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
