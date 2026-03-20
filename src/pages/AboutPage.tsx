import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Info, ArrowLeft, Code2, Bug, Shield, User, ExternalLink, Package } from 'lucide-react';
import { Card } from '@/components/common';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/types';
import api from '@/services/api';
import type { LibraryInfo } from '@/types';
import { version as uiVersion, author as devAuthor, email as devEmail, license as uiLicense } from '../../package.json';

interface GithubDep {
  name: string;
  version: string;
  license: string;
}

const FRONTEND_NOTABLE_DEPS: GithubDep[] = [
  { name: 'react', version: '', license: 'MIT' },
  { name: 'react-router-dom', version: '', license: 'MIT' },
  { name: '@tanstack/react-query', version: '', license: 'MIT' },
  { name: 'axios', version: '', license: 'MIT' },
  { name: 'i18next', version: '', license: 'MIT' },
  { name: 'react-i18next', version: '', license: 'MIT' },
  { name: 'lucide-react', version: '', license: 'ISC' },
  { name: 'recharts', version: '', license: 'MIT' },
  { name: 'tailwindcss', version: '', license: 'MIT' },
];

const BACKEND_RUNTIME = ['Rust', 'PostgreSQL', 'Redis'];

const BACKEND_NOTABLE_DEPS: GithubDep[] = [
  { name: 'actix-web', version: '', license: 'MIT/Apache-2.0' },
  { name: 'sqlx', version: '', license: 'MIT/Apache-2.0' },
  { name: 'serde', version: '', license: 'MIT/Apache-2.0' },
  { name: 'tokio', version: '', license: 'MIT' },
  { name: 'jsonwebtoken', version: '', license: 'MIT' },
];

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400 w-40 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white flex-1">{value}</span>
    </div>
  );
}

function DepList({ deps, loading, error }: { deps: GithubDep[]; loading: boolean; error: boolean }) {
  const { t } = useTranslation();
  if (loading) return <p className="text-sm text-gray-400 italic">{t('about.admin.loading')}</p>;
  if (error) return <p className="text-sm text-red-400 italic">{t('about.admin.error')}</p>;
  return (
    <ul className="space-y-1">
      {deps.map((dep) => (
        <li key={dep.name} className="text-sm flex items-center gap-2">
          <Package className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          <span className="text-gray-800 dark:text-gray-200 font-mono">{dep.name}</span>
          {dep.version && (
            <span className="text-gray-400 dark:text-gray-500">{dep.version}</span>
          )}
          <span className="ml-auto text-xs text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
            {dep.license}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function AboutPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const adminUser = isAdmin(user?.account_type);

  const [libraryInfo, setLibraryInfo] = useState<LibraryInfo | null>(null);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [frontendDeps, setFrontendDeps] = useState<GithubDep[]>(FRONTEND_NOTABLE_DEPS);
  const [backendDeps, setBackendDeps] = useState<GithubDep[]>(BACKEND_NOTABLE_DEPS);
  const [depsLoading, setDepsLoading] = useState(false);
  const [depsError, setDepsError] = useState(false);

  useEffect(() => {
    api.getLibraryInfo()
      .then(setLibraryInfo)
      .catch(() => setLibraryInfo(null));

    api.getHealth()
      .then((data) => setServerVersion(data.version ?? null))
      .catch(() => setServerVersion(null));
  }, []);

  useEffect(() => {
    if (!adminUser) return;
    setDepsLoading(true);

    Promise.all([
      fetch('https://raw.githubusercontent.com/jcollonville/elidune-ui/main/package.json')
        .then((r) => r.json())
        .catch(() => null),
      fetch('https://raw.githubusercontent.com/jcollonville/elidune-server/main/Cargo.toml')
        .then((r) => r.text())
        .catch(() => null),
    ])
      .then(([pkgJson, cargoToml]) => {
        if (pkgJson?.dependencies) {
          setFrontendDeps((prev) =>
            prev.map((dep) => ({
              ...dep,
              version: pkgJson.dependencies[dep.name]
                ? String(pkgJson.dependencies[dep.name]).replace(/[\^~]/, '')
                : pkgJson.devDependencies?.[dep.name]
                ? String(pkgJson.devDependencies[dep.name]).replace(/[\^~]/, '')
                : dep.version,
            }))
          );
        }
        if (cargoToml) {
          setBackendDeps((prev) =>
            prev.map((dep) => {
              const match = new RegExp(
                `^${dep.name.replace('-', '[_-')}]\\s*=\\s*"([^"]+)"`,
                'mi'
              ).exec(cargoToml);
              return match ? { ...dep, version: match[1] } : dep;
            })
          );
        }
      })
      .catch(() => setDepsError(true))
      .finally(() => setDepsLoading(false));
  }, [adminUser]);

  const formattedDate = libraryInfo?.updated_at
    ? new Date(libraryInfo.updated_at).toLocaleDateString(i18n.language, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
            <Info className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('about.title')}</h1>
        </div>
      </div>

      {/* Main info card */}
      <Card>
        <div className="p-6 space-y-0">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('about.description')}</p>
          <InfoRow
            label={t('about.uiVersion')}
            value={
              <span className="font-mono text-indigo-600 dark:text-indigo-400">
                v{uiVersion}
              </span>
            }
          />
          <InfoRow
            label={t('about.serverVersion')}
            value={
              <span className="font-mono text-indigo-600 dark:text-indigo-400">
                {serverVersion ? `v${serverVersion}` : '—'}
              </span>
            }
          />
          <InfoRow
            label={t('about.license')}
            value={
              <a
                href={`https://spdx.org/licenses/${uiLicense}.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-mono"
              >
                {uiLicense}
                <ExternalLink className="h-3 w-3" />
              </a>
            }
          />
          <InfoRow label={t('about.lastUpdate')} value={formattedDate} />
        </div>
      </Card>

      {/* Developer card */}
      <Card>
        <div className="p-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
            <User className="h-4 w-4" />
            {t('about.developer')}
          </h2>
          <div className="space-y-0">
            <InfoRow label={t('common.name')} value={devAuthor} />
            <InfoRow
              label={t('about.contact')}
              value={
                <a
                  href={`mailto:${devEmail}`}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {devEmail}
                </a>
              }
            />
            <InfoRow
              label={t('about.sourceCode')}
              value={
                <div className="flex flex-col gap-1">
                  <a
                    href="https://github.com/jcollonville/elidune-server"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <Code2 className="h-3.5 w-3.5" />
                    github.com/jcollonville/elidune-server
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href="https://github.com/jcollonville/elidune-ui"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <Code2 className="h-3.5 w-3.5" />
                    github.com/jcollonville/elidune-ui
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              }
            />
          </div>
        </div>
      </Card>

      {/* Legal notice */}
      <Card>
        <div className="p-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t('about.legalNotice')}
          </h2>
          <Link
            to="/privacy"
            className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <Shield className="h-4 w-4" />
            {t('about.legalNoticeLink')}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </Card>

      {/* Admin section */}
      {adminUser && (
        <Card>
          <div className="p-6 space-y-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              {t('about.admin.techInfo')}
            </h2>

            <div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Frontend stack */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    {t('about.admin.frontendStack')}
                  </h4>
                  <DepList deps={frontendDeps} loading={depsLoading} error={depsError} />
                </div>

                {/* Backend stack */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    {t('about.admin.backendStack')}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {BACKEND_RUNTIME.map((tech) => (
                      <span
                        key={tech}
                        className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                  <DepList deps={backendDeps} loading={depsLoading} error={depsError} />
                </div>
              </div>
            </div>

            {/* Bug report */}
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                <Bug className="h-4 w-4" />
                {t('about.admin.bugReport')}
              </h3>
              <a
                href="https://github.com/jcollonville/elidune/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {t('about.admin.bugReportLink')}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
