import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Phone, Mail, Clock, ExternalLink, Contact } from 'lucide-react';
import Card, { CardHeader } from './Card';
import type { LibraryInfo, ScheduleSlot } from '@/types';

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

interface LibraryInfoSectionProps {
  info: LibraryInfo | null;
  slots: ScheduleSlot[];
  canManage?: boolean;
  className?: string;
}

export default function LibraryInfoSection({
  info,
  slots,
  canManage = false,
  className = '',
}: LibraryInfoSectionProps) {
  const { t } = useTranslation();

  const addressParts = [
    info?.addrLine1,
    info?.addrLine2,
    [info?.addrPostcode, info?.addrCity].filter(Boolean).join(' '),
    info?.addrCountry,
  ].filter(Boolean) as string[];

  const slotsByDay = Object.fromEntries(slots.map((s) => [s.dayOfWeek, s]));

  return (
    <Card className={`flex flex-col ${className}`}>
      <CardHeader
        title={t('home.libraryInfo')}
        action={
          canManage ? (
            <Link
              to="/library"
              className="text-sm text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
            >
              {t('common.edit')} <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Address */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <MapPin className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <span>{t('library.general.address')}</span>
          </div>
          {addressParts.length > 0 ? (
            <address className="not-italic text-sm text-gray-600 dark:text-gray-400 space-y-0.5 pl-6">
              {addressParts.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </address>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic pl-6">
              {t('home.noAddress')}
            </p>
          )}
        </div>

        {/* Contact */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Contact className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <span>{t('library.general.contact')}</span>
          </div>
          {info?.email || (info?.phones && info.phones.length > 0) ? (
            <div className="space-y-1.5 pl-6">
              {info?.email && (
                <a
                  href={`mailto:${info.email}`}
                  className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 hover:underline"
                >
                  <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                  {info.email}
                </a>
              )}
              {info?.phones?.map((phone, i) => (
                <a
                  key={i}
                  href={`tel:${phone}`}
                  className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 hover:underline"
                >
                  <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                  {phone}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic pl-6">
              {t('home.noContact')}
            </p>
          )}
        </div>

        {/* Opening hours */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <span>{t('library.tabs.hours')}</span>
          </div>
          {slots.length > 0 ? (
            <div className="space-y-1 pl-6">
              {DAYS.map((day) => {
                const slot = slotsByDay[day];
                return (
                  <div key={day} className="flex items-baseline gap-2 text-sm">
                    <span className="w-8 font-medium text-gray-700 dark:text-gray-300 shrink-0">
                      {t(`library.hours.days.${day}`).slice(0, 3)}
                    </span>
                    {slot ? (
                      <span className="text-gray-600 dark:text-gray-400">
                        {slot.openTime.slice(0, 5)} – {slot.closeTime.slice(0, 5)}
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 italic">
                        {t('library.hours.closed')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic pl-6">
              {t('home.noSchedule')}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
