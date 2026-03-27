import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Calendar,
  Clock,
  Users,
  Tag,
  ChevronLeft,
  Trash2,
  History,
  Mail,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Card, Button, Table, Pagination, Modal, Input, ConfirmDialog } from '@/components/common';
import api from '@/services/api';
import type { Event, CreateEvent, UpdateEvent } from '@/types';

const EVENTS_PER_PAGE = 20;

// eventType: 0=animation, 1=school_visit, 2=exhibition, 3=conference, 4=workshop, 5=show, 6=other
const EVENT_TYPES = [
  { value: 0, labelKey: 'events.types.animation' },
  { value: 1, labelKey: 'events.types.schoolVisit' },
  { value: 2, labelKey: 'events.types.exhibition' },
  { value: 3, labelKey: 'events.types.conference' },
  { value: 4, labelKey: 'events.types.workshop' },
  { value: 5, labelKey: 'events.types.show' },
  { value: 6, labelKey: 'events.types.other' },
];

// targetPublic: 97=adult, 106=children, null=all
const TARGET_PUBLIC_OPTIONS = [
  { value: '', labelKey: 'events.targetPublic.all' },
  { value: '97', labelKey: 'events.targetPublic.adult' },
  { value: '106', labelKey: 'events.targetPublic.children' },
];

const EVENT_TYPE_COLORS: Record<number, string> = {
  0: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  1: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  2: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  3: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  4: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  5: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  6: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default function EventsPage() {
  const { t } = useTranslation();

  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [showPast, setShowPast] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isFormLoading, setIsFormLoading] = useState(false);

  const [announcementState, setAnnouncementState] = useState<
    Record<string, 'loading' | 'success' | 'error'>
  >({});
  const [confirmAnnouncementEvent, setConfirmAnnouncementEvent] = useState<Event | null>(null);
  const [eventPendingDelete, setEventPendingDelete] = useState<Event | null>(null);

  const doSendAnnouncement = async (event: Event) => {
    setAnnouncementState((prev) => ({ ...prev, [event.id]: 'loading' }));
    try {
      await api.sendEventAnnouncement(event.id);
      setAnnouncementState((prev) => ({ ...prev, [event.id]: 'success' }));
      setTimeout(() => {
        setAnnouncementState((prev) => {
          const next = { ...prev };
          delete next[event.id];
          return next;
        });
      }, 3000);
    } catch (error) {
      console.error('Error sending announcement:', error);
      setAnnouncementState((prev) => ({ ...prev, [event.id]: 'error' }));
      setTimeout(() => {
        setAnnouncementState((prev) => {
          const next = { ...prev };
          delete next[event.id];
          return next;
        });
      }, 3000);
    }
  };

  const handleSendAnnouncement = (event: Event, e: React.MouseEvent) => {
    e.stopPropagation();
    if (event.announcementSentAt) {
      setConfirmAnnouncementEvent(event);
    } else {
      doSendAnnouncement(event);
    }
  };

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = showPast
        ? { endDate: yesterdayStr(), page: currentPage, perPage: EVENTS_PER_PAGE }
        : { startDate: todayStr(), page: currentPage, perPage: EVENTS_PER_PAGE };
      const response = await api.getEvents(params);
      setEvents(response.events);
      setTotal(response.total);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoading(false);
    }
  }, [showPast, currentPage]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleTogglePast = () => {
    setShowPast((p) => !p);
    setCurrentPage(1);
  };

  const handleRowClick = (event: Event) => {
    setEditingEvent(event);
  };

  const performDeleteEvent = async (event: Event) => {
    try {
      await api.deleteEvent(event.id);
      setEditingEvent(null);
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const getEventTypeLabel = (type: number) => {
    const found = EVENT_TYPES.find((et) => et.value === type);
    return found ? t(found.labelKey) : String(type);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const columns = [
    {
      key: 'name',
      header: t('common.name'),
      render: (event: Event) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{event.name}</p>
          {event.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
              {event.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'eventType',
      header: t('events.type'),
      render: (event: Event) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            EVENT_TYPE_COLORS[event.eventType] ?? EVENT_TYPE_COLORS[6]
          }`}
        >
          <Tag className="h-3 w-3" />
          {getEventTypeLabel(event.eventType)}
        </span>
      ),
    },
    {
      key: 'eventDate',
      header: t('events.date'),
      render: (event: Event) => (
        <div className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
          <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span>{formatDate(event.eventDate)}</span>
          {(event.startTime || event.endTime) && (
            <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              {event.startTime && event.endTime
                ? `${event.startTime}–${event.endTime}`
                : event.startTime || event.endTime}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'attendees',
      header: t('events.attendees'),
      render: (event: Event) =>
        event.attendeesCount != null ? (
          <div className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
            <Users className="h-4 w-4 text-gray-400" />
            <span>{event.attendeesCount}</span>
            {event.studentsCount != null && (
              <span className="text-gray-500 dark:text-gray-400">
                {' '}+ {event.studentsCount} {t('events.students')}
              </span>
            )}
          </div>
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (event: Event) => {
        const state = announcementState[event.id];
        return (
          <div className="flex justify-end">
          <button
            onClick={(e) => handleSendAnnouncement(event, e)}
            disabled={state === 'loading'}
            title={t('events.sendAnnouncement')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              state === 'success'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                : state === 'error'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                  : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {state === 'loading' ? (
              <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : state === 'success' ? (
              <CheckCircle className="h-3.5 w-3.5" />
            ) : state === 'error' ? (
              <AlertCircle className="h-3.5 w-3.5" />
            ) : (
              <Mail className="h-3.5 w-3.5" />
            )}
            <span>
              {state === 'success'
                ? t('events.announcementSent')
                : state === 'error'
                  ? t('common.error')
                  : t('events.sendAnnouncement')}
            </span>
          </button>
          </div>
        );
      },
    },
  ];

  const totalPages = Math.ceil(total / EVENTS_PER_PAGE);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('events.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {showPast ? t('events.pastEvents') : t('events.currentEvents')} ·{' '}
            {t('events.count', { count: total })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleTogglePast}
            leftIcon={showPast ? <ChevronLeft className="h-4 w-4" /> : <History className="h-4 w-4" />}
          >
            {showPast ? t('events.showCurrent') : t('events.showPast')}
          </Button>
          <Button onClick={() => setShowCreateModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
            {t('events.newEvent')}
          </Button>
        </div>
      </div>

      {/* Events table */}
      <Card padding="none">
        <Table
          columns={columns}
          data={events}
          keyExtractor={(event) => event.id}
          onRowClick={handleRowClick}
          isLoading={isLoading}
          emptyMessage={showPast ? t('events.noPastEvents') : t('events.noCurrentEvents')}
        />
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </Card>

      {/* Create modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('events.newEvent')}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="create-event-form" isLoading={isFormLoading}>
              {t('common.create')}
            </Button>
          </div>
        }
      >
        <EventForm
          formId="create-event-form"
          onLoadingChange={setIsFormLoading}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchEvents();
          }}
        />
      </Modal>

      {/* Announcement re-send confirmation modal */}
      <Modal
        isOpen={!!confirmAnnouncementEvent}
        onClose={() => setConfirmAnnouncementEvent(null)}
        title={t('events.announcementAlreadySentTitle')}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmAnnouncementEvent(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (confirmAnnouncementEvent) {
                  doSendAnnouncement(confirmAnnouncementEvent);
                }
                setConfirmAnnouncementEvent(null);
              }}
              leftIcon={<Mail className="h-4 w-4" />}
            >
              {t('events.sendAnywayBtn')}
            </Button>
          </div>
        }
      >
        {confirmAnnouncementEvent?.announcementSentAt && (
          <div className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p>
              {t('events.announcementAlreadySentBody', {
                date: new Date(confirmAnnouncementEvent.announcementSentAt).toLocaleString(),
                name: confirmAnnouncementEvent.name,
              })}
            </p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={eventPendingDelete !== null}
        onClose={() => setEventPendingDelete(null)}
        onConfirm={() => {
          const ev = eventPendingDelete;
          setEventPendingDelete(null);
          if (ev) void performDeleteEvent(ev);
        }}
        message={
          eventPendingDelete ? t('events.confirmDelete', { name: eventPendingDelete.name }) : ''
        }
        confirmVariant="danger"
        stackOnTop
      />

      {/* Edit modal */}
      <Modal
        isOpen={!!editingEvent}
        onClose={() => setEditingEvent(null)}
        title={t('events.editEvent')}
        size="lg"
        footer={
          <div className="flex justify-between gap-2">
            <Button
              variant="danger"
              onClick={() => {
                if (!editingEvent) return;
                setEventPendingDelete(editingEvent);
                setEditingEvent(null);
              }}
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              {t('common.delete')}
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditingEvent(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" form="edit-event-form" isLoading={isFormLoading}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        }
      >
        {editingEvent && (
          <EventForm
            formId="edit-event-form"
            initialValues={editingEvent}
            onLoadingChange={setIsFormLoading}
            onSuccess={() => {
              setEditingEvent(null);
              fetchEvents();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

interface EventFormProps {
  formId: string;
  initialValues?: Event;
  onLoadingChange: (loading: boolean) => void;
  onSuccess: () => void;
}

function EventForm({ formId, initialValues, onLoadingChange, onSuccess }: EventFormProps) {
  const { t } = useTranslation();
  const isEdit = !!initialValues;

  const [formData, setFormData] = useState({
    name: initialValues?.name ?? '',
    eventDate: initialValues?.eventDate ?? '',
    eventType: initialValues?.eventType != null ? String(initialValues.eventType) : '0',
    startTime: initialValues?.startTime ?? '',
    endTime: initialValues?.endTime ?? '',
    description: initialValues?.description ?? '',
    partnerName: initialValues?.partnerName ?? '',
    schoolName: initialValues?.schoolName ?? '',
    className: initialValues?.className ?? '',
    attendeesCount: initialValues?.attendeesCount != null ? String(initialValues.attendeesCount) : '',
    studentsCount: initialValues?.studentsCount != null ? String(initialValues.studentsCount) : '',
    targetPublic: initialValues?.targetPublic != null ? String(initialValues.targetPublic) : '',
    notes: initialValues?.notes ?? '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onLoadingChange(true);
    try {
      const payload: CreateEvent | UpdateEvent = {
        name: formData.name || undefined,
        eventDate: formData.eventDate || undefined,
        eventType: formData.eventType !== '' ? Number(formData.eventType) : undefined,
        startTime: formData.startTime || null,
        endTime: formData.endTime || null,
        description: formData.description || null,
        partnerName: formData.partnerName || null,
        schoolName: formData.schoolName || null,
        className: formData.className || null,
        attendeesCount: formData.attendeesCount !== '' ? Number(formData.attendeesCount) : null,
        studentsCount: formData.studentsCount !== '' ? Number(formData.studentsCount) : null,
        targetPublic: formData.targetPublic !== '' ? Number(formData.targetPublic) : null,
        notes: formData.notes || null,
      };

      if (isEdit && initialValues) {
        await api.updateEvent(initialValues.id, payload as UpdateEvent);
      } else {
        await api.createEvent(payload as CreateEvent);
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving event:', error);
    } finally {
      onLoadingChange(false);
    }
  };

  const schoolVisit = formData.eventType === '1';

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      {/* Basic info */}
      <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {t('events.basicInfo')}
      </h4>
      <Input
        label={t('common.name')}
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required={!isEdit}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label={t('events.date')}
          type="date"
          value={formData.eventDate}
          onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
          required={!isEdit}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('events.type')}
          </label>
          <select
            value={formData.eventType}
            onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            {EVENT_TYPES.map((et) => (
              <option key={et.value} value={String(et.value)}>
                {t(et.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label={t('events.startTime')}
          type="time"
          value={formData.startTime}
          onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
        />
        <Input
          label={t('events.endTime')}
          type="time"
          value={formData.endTime}
          onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('common.description')}
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none"
        />
      </div>

      {/* Audience & partner */}
      <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-2">
        {t('events.audienceInfo')}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('events.targetPublicLabel')}
          </label>
          <select
            value={formData.targetPublic}
            onChange={(e) => setFormData({ ...formData, targetPublic: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            {TARGET_PUBLIC_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </div>
        <Input
          label={t('events.attendeesCount')}
          type="number"
          min="0"
          value={formData.attendeesCount}
          onChange={(e) => setFormData({ ...formData, attendeesCount: e.target.value })}
        />
      </div>
      <Input
        label={t('events.partnerName')}
        value={formData.partnerName}
        onChange={(e) => setFormData({ ...formData, partnerName: e.target.value })}
      />

      {/* School visit fields */}
      {schoolVisit && (
        <>
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-2">
            {t('events.schoolInfo')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('events.schoolName')}
              value={formData.schoolName}
              onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
            />
            <Input
              label={t('events.className')}
              value={formData.className}
              onChange={(e) => setFormData({ ...formData, className: e.target.value })}
            />
          </div>
          <Input
            label={t('events.studentsCount')}
            type="number"
            min="0"
            value={formData.studentsCount}
            onChange={(e) => setFormData({ ...formData, studentsCount: e.target.value })}
          />
        </>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('users.notes')}
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={2}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none"
        />
      </div>
    </form>
  );
}
