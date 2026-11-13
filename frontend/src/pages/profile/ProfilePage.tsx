import { ProfileForm } from '../../components/profile/ProfileForm'
import { ChangePasswordForm } from '../../components/settings/ChangePasswordForm'
import { Alert } from '../../components/ui/Alert'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { useOwnProfile } from '../../hooks/useOwnProfile'
import { AppLayout } from '../../layouts/AppLayout'
import type { OwnProfile } from '../../types/profile'
import { getRoleLabel } from '../../utils/format'
import { profileFullName } from '../../utils/profile'

import './ProfilePage.css'

function ProfileSummary({ profile }: { profile: OwnProfile }) {
  const fullName = profileFullName(profile)
  return (
    <section className="profile-summary" aria-label="Tu cuenta">
      {profile.person.profilePhotoUrl ? (
        <img className="profile-summary__photo" src={profile.person.profilePhotoUrl} alt="" />
      ) : (
        <Avatar name={fullName} size="xl" highlighted />
      )}
      <div className="profile-summary__text">
        <p className="profile-summary__name">{fullName}</p>
        <p className="profile-summary__email">{profile.email}</p>
        <div className="profile-summary__chips">
          <span className="profile-summary__chip profile-summary__chip--role">
            {getRoleLabel(profile.role.name)}
          </span>
          {profile.branches.map((branch) => (
            <span key={branch.id} className="profile-summary__chip">
              {branch.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ProfilePage() {
  const { status, profile, error, refetch, replace } = useOwnProfile()

  const renderContent = () => {
    if (status === 'error') {
      return (
        <div className="profile-page__feedback">
          <Alert tone="error">{error}</Alert>
          <Button variant="outline" onClick={refetch}>
            Reintentar
          </Button>
        </div>
      )
    }
    if (!profile) {
      return (
        <p className="profile-page__loading" role="status">
          Cargando tu perfil...
        </p>
      )
    }
    return (
      <>
        <ProfileSummary profile={profile} />
        <ProfileForm profile={profile} onSaved={replace} />
        <ChangePasswordForm />
      </>
    )
  }

  return (
    <AppLayout title="Mi perfil" subtitle="Tus datos de contacto y tu contraseña">
      <div className="profile-page">{renderContent()}</div>
    </AppLayout>
  )
}
