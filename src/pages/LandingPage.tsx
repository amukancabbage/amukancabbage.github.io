import { Archive, FileCheck, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import library from '../assets/library.webp';
import librarySmall from '../assets/library-small.webp';
import { useAuth } from '../auth';
import AppIcon from '../components/AppIcon';
import PublicShell from '../components/PublicShell';

const services = [
  {
    title: 'Kegiatan akademik',
    description: 'Catat penelitian, pengabdian kepada masyarakat, dan artikel mahasiswa.',
    icon: GraduationCap,
  },
  {
    title: 'Dokumen HKI',
    description: 'Unggah sertifikat, perbarui metadata, dan tinjau dokumen sesuai peran.',
    icon: FileCheck,
  },
  {
    title: 'Rekap dan arsip',
    description: 'Lihat rekap akademik, telusuri dokumen tervalidasi, dan ekspor data.',
    icon: Archive,
  },
];

export default function LandingPage() {
  const { session } = useAuth();
  const action = session
    ? { to: '/beranda', label: 'Buka beranda' }
    : { to: '/masuk', label: 'Masuk' };

  return (
    <PublicShell title="SISIDOS | Sistem Informasi Dosen" action={action}>
      <main className="tw:grow">
        <section className="public-container landing-hero tw:grid tw:items-center" aria-labelledby="landing-title">
          <div>
            <h1 id="landing-title">Sistem Informasi Dosen</h1>
            <p>Kelola kegiatan akademik dan dokumen Hak Kekayaan Intelektual (HKI) sesuai hak akses Anda.</p>
            <Link to={action.to} className="button-link landing-action">
              {session ? action.label : 'Masuk ke SISIDOS'}
            </Link>
          </div>
          <img
            className="landing-image tw:block tw:w-full tw:rounded-panel tw:object-cover"
            src={library}
            srcSet={`${librarySmall} 640w, ${library} 1200w`}
            sizes="(min-width: 1280px) 600px, (min-width: 768px) 49vw, 92vw"
            width={1200}
            height={900}
            alt=""
            fetchPriority="high"
          />
        </section>
        <section className="landing-services" aria-labelledby="services-title">
          <div className="public-container">
            <h2 id="services-title">Layanan SISIDOS</h2>
            <ul className="landing-service-list tw:m-0 tw:grid tw:list-none tw:p-0" role="list">
              {services.map(({ title, description, icon }) => (
                <li className="landing-service tw:flex tw:items-start tw:gap-3" key={title}>
                  <AppIcon icon={icon} size={20} />
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
