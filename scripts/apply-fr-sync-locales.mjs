/**
 * Applies English / Spanish / German strings for keys that were merged from FR.
 * Run: node scripts/apply-fr-sync-locales.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../src/locales');

function flatten(obj, prefix = '') {
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const p = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, p));
    else out[p] = v;
  }
  return out;
}

function unflatten(flat) {
  const root = {};
  for (const [k, v] of Object.entries(flat)) {
    const parts = k.split('.');
    let o = root;
    for (let i = 0; i < parts.length - 1; i++) {
      o[parts[i]] = o[parts[i]] || {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = v;
  }
  return root;
}

function setNested(root, dotPath, value) {
  const parts = dotPath.split('.');
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] === undefined || typeof cur[p] !== 'object' || Array.isArray(cur[p])) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

// English overrides for keys that were copied from FR during sync
const enFlat = {
  'common.showFilters': 'Show filters',
  'common.hideFilters': 'Hide filters',
  'common.poweredBy': 'Powered by',
  'common.page': 'Page',
  'users.pastLoansTab': 'Past loans',
  'users.holdsTab': 'Holds',
  'users.activeLoansForceDelete':
    'This patron still has active loans. Force deletion is irreversible. Confirm?',
  'users.forceDelete': 'Force delete',
  'users.subscriptionValidUntil': 'Until {{date}}',
  'stats.loansByType': 'Loans and returns for type: {{type}}',
  'stats.advancedFilters': 'Advanced filters',
  'stats.startDate': 'Start date',
  'stats.endDate': 'End date',
  'stats.intervalLabel': 'Interval',
  'stats.mediaType': 'Document type',
  'stats.user': 'User',
  'stats.allTypes': 'All types',
  'stats.allUsers': 'All users',
  'stats.viewingMyStats': 'Viewing your statistics: {{name}}',
  'stats.interval.day': 'By day',
  'stats.interval.week': 'By week',
  'stats.interval.month': 'By month',
  'stats.interval.year': 'By year',
  'stats.weekFormat': 'Week {{week}} of {{year}}',
  'settings.server.sections.holds': 'Holds (pickup)',
  'settings.server.readyExpiryDays':
    'Days to pick up the copy after notification (“ready” hold)',
  'settings.server.holdsOverridable': 'Allow overriding this section in the database',
  'settings.maintenance.actions.cleanupDanglingBiblioSeries.label': 'Clean up orphan series links',
  'settings.maintenance.actions.cleanupDanglingBiblioSeries.description':
    'Removes biblio→series links pointing to non-existent series.',
  'settings.maintenance.actions.cleanupDanglingBiblioCollections.label': 'Clean up orphan collection links',
  'settings.maintenance.actions.cleanupDanglingBiblioCollections.description':
    'Removes biblio→collection links pointing to non-existent collections.',
  'settings.maintenance.actions.cleanupSeries.label': 'Clean up series',
  'settings.maintenance.actions.cleanupSeries.description':
    'Strips quotes around names and deletes series with no bibliographic records.',
  'settings.maintenance.actions.cleanupCollections.label': 'Clean up collections',
  'settings.maintenance.actions.cleanupCollections.description':
    'Strips quotes around names and deletes collections with no bibliographic records.',
  'settings.maintenance.actions.mergeDuplicateSeries.label': 'Merge duplicate series',
  'settings.maintenance.actions.mergeDuplicateSeries.description':
    'Merges duplicate series and moves biblio links.',
  'settings.maintenance.actions.mergeDuplicateCollections.label': 'Merge duplicate collections',
  'settings.maintenance.actions.mergeDuplicateCollections.description':
    'Merges duplicate collections and moves biblio links.',
  'settings.maintenance.actions.cleanupOrphanAuthors.label': 'Clean up orphan authors',
  'settings.maintenance.actions.cleanupOrphanAuthors.description':
    'Deletes authors not referenced by any bibliographic record.',
  'errors.apiCode.authentication_failed': 'Authentication failed. Check your credentials.',
  'errors.apiCode.authorization_failed': 'You do not have permission to perform this action.',
  'errors.apiCode.not_found': 'Resource not found.',
  'errors.apiCode.validation_error': 'The submitted data is invalid.',
  'errors.apiCode.bad_request': 'Invalid request.',
  'errors.apiCode.conflict': 'Conflict: this record already exists.',
  'errors.apiCode.business_rule_violation':
    'Action refused by a business rule (expired subscription, quota reached, etc.).',
  'errors.apiCode.duplicate_isbn_needs_confirmation': 'A document with this ISBN already exists.',
  'errors.apiCode.duplicate_barcode_needs_confirmation':
    'A copy with this barcode already exists.',
  'errors.apiCode.z3950_error': 'Error during Z39.50 search.',
  'errors.apiCode.database_error': 'Database error. Please try again later.',
  'errors.apiCode.internal_error': 'Internal server error. Please try again later.',
  'errors.tooManyRequests': 'Too many attempts. Please wait before trying again.',
  'codes.publicType.juvenile': 'Juvenile',
  'codes.publicType.preschool': 'Preschool',
  'codes.publicType.primary': 'Primary',
  'codes.publicType.youngAdult': 'Young adult',
  'codes.publicType.adultSerious': 'Adult (serious reading)',
  'codes.publicType.general': 'General audience',
  'codes.publicType.specialized': 'Specialized',
  'codes.function.scientificAdvisor': 'Scientific advisor',
  'codes.function.prefaceWriter': 'Author of preface',
  'codes.function.publishingDirector': 'Publishing director',
  'fines.title': 'Fines',
  'fines.noFines': 'No fines.',
  'fines.totalUnpaid': 'Total unpaid',
  'fines.status': 'Status',
  'fines.pay': 'Pay',
  'fines.waive': 'Waive',
  'fines.statuses.pending': 'Pending',
  'fines.statuses.partial': 'Partial',
  'fines.statuses.paid': 'Paid',
  'fines.statuses.waived': 'Waived',
  'holds.title': 'Holds',
  'holds.activeHoldsTitle': 'Active holds',
  'holds.activeHoldsCount': '{{total}} active hold(s)',
  'holds.newHoldButton': 'New hold',
  'holds.noActiveHolds': 'No active holds.',
  'holds.subtitle': 'Active holds (pending or ready for pickup)',
  'holds.pageTitle': 'Hold management',
  'holds.reserve': 'Place hold',
  'holds.dialogTitle': 'Confirm hold',
  'holds.confirmReserve': 'Place hold',
  'holds.notesOptional': 'Notes (optional)',
  'holds.createError': 'Could not create the hold.',
  'holds.selectUser': 'Select a patron.',
  'holds.reserveFor': 'Hold for',
  'holds.forMe': 'For me',
  'holds.forUser': 'For a patron',
  'holds.selectedUser': 'Selected patron',
  'holds.hintBorrowed':
    'This copy is currently on loan. You will be notified when it is available for you.',
  'holds.hintQueue':
    'Other holds are in the queue ({{count}} waiting). You will be notified in turn; your position will be about {{position}}.',
  'holds.hintNotifyWhenReady': 'You will be notified when the copy is available for you.',
  'holds.searchBiblio': 'Search a bibliographic record (title, author, ISBN…)',
  'holds.pickSpecimen': 'Copy',
  'holds.createSection': 'New hold',
  'holds.userSection': "Patron's holds",
  'holds.queueSection': 'Copy hold queue',
  'holds.pickUser': 'Search a patron',
  'holds.loadUserHolds': 'Show',
  'holds.columnUser': 'Patron',
  'holds.columnDocument': 'Document',
  'holds.itemId': 'Copy (ID)',
  'holds.cancelHold': 'Cancel hold',
  'holds.cancelConfirm': 'Cancel this hold?',
  'holds.createdAt': 'Created',
  'holds.expiresAt': 'Expires',
  'holds.noHolds': 'No holds.',
  'holds.position': 'Position',
  'holds.status': 'Status',
  'holds.notes': 'Notes',
  'holds.biblio': 'Bibliographic record',
  'holds.statuses.pending': 'Pending',
  'holds.statuses.ready': 'Ready for pickup',
  'holds.statuses.fulfilled': 'Fulfilled',
  'holds.statuses.cancelled': 'Cancelled',
  'holds.statuses.expired': 'Expired',
  'history.title': 'Reading history',
  'history.rgpdToggle': 'Keep reading history',
  'history.rgpdHint':
    'When enabled, your past loans are kept for personal use. You can turn this off at any time.',
  'history.enable': 'Enable',
  'history.disable': 'Disable',
  'catalog.pageTitle': 'Catalog',
  'catalog.tabCatalog': 'Bibliographic records',
  'catalog.tabCollections': 'Collections',
  'catalog.tabSeries': 'Series',
  'catalog.collectionName': 'Name',
  'catalog.collectionSecondaryTitle': 'Secondary title',
  'catalog.collectionTertiaryTitle': 'Tertiary title',
  'catalog.collectionCount': '{{count}} collection(s)',
  'catalog.noCollections': 'No collections.',
  'catalog.addCollection': 'New collection',
  'catalog.editCollection': 'Edit collection',
  'catalog.deleteCollectionConfirm':
    'Delete collection “{{name}}”? This cannot be undone.',
  'catalog.searchCollections': 'Search by name or identifier (UUID)…',
  'catalog.serieName': 'Name',
  'catalog.serieCount': '{{count}} series',
  'catalog.noSeries': 'No series.',
  'catalog.addSerie': 'New series',
  'catalog.editSerie': 'Edit series',
  'catalog.deleteSerieConfirm': 'Delete series “{{name}}”? This cannot be undone.',
  'catalog.searchSeries': 'Search by name or identifier (UUID)…',
  'catalog.key': 'Key',
  'catalog.volumeNumber': 'No.',
  'catalog.willCreate': 'will be created',
  'catalog.useAndCreate': 'Use “{{name}}” (create if missing)',
  'catalog.searchOrCreateCollection': 'Search or enter a collection…',
  'catalog.searchOrCreateSerie': 'Search or enter a series…',
  'catalog.filteredBy': 'Filtered by:',
  'catalog.clearFilter': 'Clear filter',
  'catalog.openInCatalog': 'Show matching documents in the catalog',
  'backgroundTask.status.pending': 'Task pending…',
  'backgroundTask.status.running': 'Task running…',
  'backgroundTask.status.completed': 'Task completed',
  'backgroundTask.status.failed': 'Task failed',
  'backgroundTask.progress': 'Progress',
  'backgroundTask.marcImport.completedSummary':
    '{{imported}} record(s) imported, {{failed}} failure(s).',
};

// Spanish: map English string → Spanish (for keys still equal to FR after merge)
const esByEn = {
  'Show filters': 'Mostrar filtros',
  'Hide filters': 'Ocultar filtros',
  'Powered by': 'Con tecnología de',
  'Page': 'Página',
  'Inventory': 'Inventario',
  'Library information': 'Información de la biblioteca',
  'No address': 'Sin dirección',
  'No contact': 'Sin contacto',
  'No schedule': 'Sin horario',
  'Contact': 'Contacto',
  'Past loans': 'Préstamos anteriores',
  'Holds': 'Reservas',
  'This patron still has active loans. Force deletion is irreversible. Confirm?':
    'Este usuario aún tiene préstamos activos. La eliminación forzada es irreversible. ¿Confirmar?',
  'Force delete': 'Forzar eliminación',
  'Until {{date}}': 'Hasta el {{date}}',
  'Loans and returns for type: {{type}}': 'Préstamos y devoluciones por tipo: {{type}}',
  'Advanced filters': 'Filtros avanzados',
  'Start date': 'Fecha de inicio',
  'End date': 'Fecha de fin',
  'Interval': 'Intervalo',
  'Document type': 'Tipo de documento',
  'User': 'Usuario',
  'All types': 'Todos los tipos',
  'All users': 'Todos los usuarios',
  'Viewing your statistics: {{name}}': 'Viendo sus estadísticas: {{name}}',
  'By day': 'Por día',
  'By week': 'Por semana',
  'By month': 'Por mes',
  'By year': 'Por año',
  'Week {{week}} of {{year}}': 'Semana {{week}} de {{year}}',
  'Holds (pickup)': 'Reservas (recogida)',
  'Days to pick up the copy after notification (“ready” hold)':
    'Días para recoger el ejemplar tras la notificación (reserva «lista»)',
  'Allow overriding this section in the database':
    'Permitir sobrescribir esta sección en la base de datos',
  'Clean up orphan series links': 'Limpiar enlaces de serie huérfanos',
  'Removes biblio→series links pointing to non-existent series.':
    'Elimina enlaces biblio→serie que apuntan a series inexistentes.',
  'Clean up orphan collection links': 'Limpiar enlaces de colección huérfanos',
  'Removes biblio→collection links pointing to non-existent collections.':
    'Elimina enlaces biblio→colección que apuntan a colecciones inexistentes.',
  'Clean up series': 'Limpiar series',
  'Strips quotes around names and deletes series with no bibliographic records.':
    'Quita comillas alrededor de los nombres y elimina series sin registros bibliográficos.',
  'Clean up collections': 'Limpiar colecciones',
  'Strips quotes around names and deletes collections with no bibliographic records.':
    'Quita comillas alrededor de los nombres y elimina colecciones sin registros bibliográficos.',
  'Merge duplicate series': 'Fusionar series duplicadas',
  'Merges duplicate series and moves biblio links.':
    'Fusiona series duplicadas y mueve los enlaces biblio.',
  'Merge duplicate collections': 'Fusionar colecciones duplicadas',
  'Merges duplicate collections and moves biblio links.':
    'Fusiona colecciones duplicadas y mueve los enlaces biblio.',
  'Clean up orphan authors': 'Limpiar autores huérfanos',
  'Deletes authors not referenced by any bibliographic record.':
    'Elimina autores no referenciados por ningún registro bibliográfico.',
  'Authentication failed. Check your credentials.': 'Autenticación fallida. Compruebe sus credenciales.',
  'You do not have permission to perform this action.':
    'No tiene permiso para realizar esta acción.',
  'Resource not found.': 'Recurso no encontrado.',
  'The submitted data is invalid.': 'Los datos enviados no son válidos.',
  'Invalid request.': 'Solicitud no válida.',
  'Conflict: this record already exists.': 'Conflicto: este registro ya existe.',
  'Action refused by a business rule (expired subscription, quota reached, etc.).':
    'Acción rechazada por una regla de negocio (suscripción caducada, cuota alcanzada, etc.).',
  'A document with this ISBN already exists.': 'Ya existe un documento con este ISBN.',
  'A copy with this barcode already exists.': 'Ya existe un ejemplar con este código de barras.',
  'Error during Z39.50 search.': 'Error durante la búsqueda Z39.50.',
  'Database error. Please try again later.':
    'Error de base de datos. Inténtelo de nuevo más tarde.',
  'Internal server error. Please try again later.':
    'Error interno del servidor. Inténtelo de nuevo más tarde.',
  'Too many attempts. Please wait before trying again.':
    'Demasiados intentos. Espere antes de volver a intentarlo.',
  'Juvenile': 'Infantil y juvenil',
  'Preschool': 'Preescolar',
  'Primary': 'Primaria',
  'Young adult': 'Joven adulto',
  'Adult (serious reading)': 'Adulto (lectura seria)',
  'General audience': 'Público general',
  'Specialized': 'Especializado',
  'Scientific advisor': 'Asesor científico',
  'Author of preface': 'Autor del prólogo',
  'Publishing director': 'Director de publicación',
  'Fines': 'Multas',
  'No fines.': 'Sin multas.',
  'Total unpaid': 'Total pendiente',
  'Status': 'Estado',
  'Pay': 'Pagar',
  'Waive': 'Condonar',
  'Pending': 'Pendiente',
  'Partial': 'Parcial',
  'Paid': 'Pagado',
  'Waived': 'Condonado',
  'Active holds': 'Reservas activas',
  '{{total}} active hold(s)': '{{total}} reserva(s) activa(s)',
  'New hold': 'Nueva reserva',
  'No active holds.': 'No hay reservas activas.',
  'Active holds (pending or ready for pickup)':
    'Reservas activas (pendientes o listas para recogida)',
  'Hold management': 'Gestión de reservas',
  'Place hold': 'Reservar',
  'Confirm hold': 'Confirmar reserva',
  'Notes (optional)': 'Notas (opcional)',
  'Could not create the hold.': 'No se pudo crear la reserva.',
  'Select a patron.': 'Seleccione un usuario.',
  'Hold for': 'Reserva para',
  'For me': 'Para mí',
  'For a patron': 'Para un usuario',
  'Selected patron': 'Usuario seleccionado',
  'This copy is currently on loan. You will be notified when it is available for you.':
    'Este ejemplar está prestado. Se le avisará cuando esté disponible para usted.',
  'Other holds are in the queue ({{count}} waiting). You will be notified in turn; your position will be about {{position}}.':
    'Hay otras reservas en cola ({{count}} en espera). Se le avisará por turno; su posición será aproximadamente la {{position}}.',
  'You will be notified when the copy is available for you.':
    'Se le avisará cuando el ejemplar esté disponible para usted.',
  'Search a bibliographic record (title, author, ISBN…)':
    'Buscar un registro bibliográfico (título, autor, ISBN…)',
  'Copy': 'Ejemplar',
  "Patron's holds": 'Reservas de un usuario',
  'Copy hold queue': 'Cola de reservas del ejemplar',
  'Search a patron': 'Buscar un usuario',
  'Show': 'Mostrar',
  'Patron': 'Usuario',
  'Document': 'Documento',
  'Copy (ID)': 'Ejemplar (ID)',
  'Cancel hold': 'Cancelar reserva',
  'Cancel this hold?': '¿Cancelar esta reserva?',
  'Created': 'Creada el',
  'Expires': 'Caduca el',
  'No holds.': 'Sin reservas.',
  'Position': 'Posición',
  'Notes': 'Notas',
  'Bibliographic record': 'Registro bibliográfico',
  'Ready for pickup': 'Listo para recogida',
  'Fulfilled': 'Completada',
  'Cancelled': 'Cancelada',
  'Expired': 'Caducada',
  'Reading history': 'Historial de lectura',
  'Keep reading history': 'Conservar el historial de lectura',
  'When enabled, your past loans are kept for personal use. You can turn this off at any time.':
    'Si está activado, sus préstamos pasados se conservan para uso personal. Puede desactivarlo en cualquier momento.',
  'Enable': 'Activar',
  'Disable': 'Desactivar',
  'Catalog': 'Catálogo',
  'Bibliographic records': 'Registros',
  'Collections': 'Colecciones',
  'Series': 'Series',
  'Name': 'Nombre',
  'Secondary title': 'Título secundario',
  'Tertiary title': 'Título terciario',
  '{{count}} collection(s)': '{{count}} colección(es)',
  'No collections.': 'Sin colecciones.',
  'New collection': 'Nueva colección',
  'Edit collection': 'Editar colección',
  'Delete collection “{{name}}”? This cannot be undone.':
    '¿Eliminar la colección «{{name}}»? Esta acción no se puede deshacer.',
  'Search by name or identifier (UUID)…': 'Buscar por nombre o identificador (UUID)…',
  '{{count}} series': '{{count}} serie(s)',
  'No series.': 'Sin series.',
  'New series': 'Nueva serie',
  'Edit series': 'Editar serie',
  'Delete series “{{name}}”? This cannot be undone.':
    '¿Eliminar la serie «{{name}}»? Esta acción no se puede deshacer.',
  'Key': 'Clave',
  'No.': 'Nº',
  'will be created': 'se creará',
  'Use “{{name}}” (create if missing)': 'Usar «{{name}}» (crear si falta)',
  'Search or enter a collection…': 'Buscar o introducir una colección…',
  'Search or enter a series…': 'Buscar o introducir una serie…',
  'Filtered by:': 'Filtrado por:',
  'Clear filter': 'Quitar filtro',
  'Show matching documents in the catalog':
    'Mostrar los documentos coincidentes en el catálogo',
  'Task pending…': 'Tarea pendiente…',
  'Task running…': 'Tarea en curso…',
  'Task completed': 'Tarea completada',
  'Task failed': 'Tarea con error',
  'Progress': 'Progreso',
  '{{imported}} record(s) imported, {{failed}} failure(s).':
    '{{imported}} registro(s) importado(s), {{failed}} error(es).',
};

// German: map English string → German
const deByEn = {
  'Show filters': 'Filter anzeigen',
  'Hide filters': 'Filter ausblenden',
  'Powered by': 'Bereitgestellt von',
  'Page': 'Seite',
  'Inventory': 'Bestand',
  'Library information': 'Bibliotheksinformationen',
  'No address': 'Keine Adresse',
  'No contact': 'Kein Kontakt',
  'No schedule': 'Keine Öffnungszeiten',
  'Contact': 'Kontakt',
  'Past loans': 'Frühere Ausleihen',
  'Holds': 'Vorbestellungen',
  'This patron still has active loans. Force deletion is irreversible. Confirm?':
    'Dieser Benutzer hat noch aktive Ausleihen. Das erzwungene Löschen ist unwiderruflich. Bestätigen?',
  'Force delete': 'Löschen erzwingen',
  'Until {{date}}': 'Bis zum {{date}}',
  'Loans and returns for type: {{type}}': 'Ausleihen und Rückgaben nach Typ: {{type}}',
  'Advanced filters': 'Erweiterte Filter',
  'Start date': 'Startdatum',
  'End date': 'Enddatum',
  'Interval': 'Intervall',
  'Document type': 'Dokumenttyp',
  'User': 'Benutzer',
  'All types': 'Alle Typen',
  'All users': 'Alle Benutzer',
  'Viewing your statistics: {{name}}': 'Ihre Statistiken: {{name}}',
  'By day': 'Pro Tag',
  'By week': 'Pro Woche',
  'By month': 'Pro Monat',
  'By year': 'Pro Jahr',
  'Week {{week}} of {{year}}': 'Woche {{week}} {{year}}',
  'Holds (pickup)': 'Vorbestellungen (Abholung)',
  'Days to pick up the copy after notification (“ready” hold)':
    'Tage zur Abholung des Exemplars nach Benachrichtigung („bereit“)',
  'Allow overriding this section in the database':
    'Überschreiben dieses Abschnitts in der Datenbank erlauben',
  'Clean up orphan series links': 'Verwaiste Serienverknüpfungen bereinigen',
  'Removes biblio→series links pointing to non-existent series.':
    'Entfernt Biblio→Serien-Links auf nicht existierende Serien.',
  'Clean up orphan collection links': 'Verwaiste Sammlungsverknüpfungen bereinigen',
  'Removes biblio→collection links pointing to non-existent collections.':
    'Entfernt Biblio→Sammlungs-Links auf nicht existierende Sammlungen.',
  'Clean up series': 'Serien bereinigen',
  'Strips quotes around names and deletes series with no bibliographic records.':
    'Entfernt Anführungszeichen um Namen und löscht Serien ohne Titel.',
  'Clean up collections': 'Sammlungen bereinigen',
  'Strips quotes around names and deletes collections with no bibliographic records.':
    'Entfernt Anführungszeichen um Namen und löscht Sammlungen ohne Titel.',
  'Merge duplicate series': 'Doppelte Serien zusammenführen',
  'Merges duplicate series and moves biblio links.':
    'Führt doppelte Serien zusammen und verschiebt Biblio-Verknüpfungen.',
  'Merge duplicate collections': 'Doppelte Sammlungen zusammenführen',
  'Merges duplicate collections and moves biblio links.':
    'Führt doppelte Sammlungen zusammen und verschiebt Biblio-Verknüpfungen.',
  'Clean up orphan authors': 'Verwaiste Autoren bereinigen',
  'Deletes authors not referenced by any bibliographic record.':
    'Löscht Autoren, die in keinem Titel verwendet werden.',
  'Authentication failed. Check your credentials.':
    'Authentifizierung fehlgeschlagen. Prüfen Sie Ihre Zugangsdaten.',
  'You do not have permission to perform this action.':
    'Sie haben keine Berechtigung für diese Aktion.',
  'Resource not found.': 'Ressource nicht gefunden.',
  'The submitted data is invalid.': 'Die eingegebenen Daten sind ungültig.',
  'Invalid request.': 'Ungültige Anfrage.',
  'Conflict: this record already exists.': 'Konflikt: Dieser Datensatz existiert bereits.',
  'Action refused by a business rule (expired subscription, quota reached, etc.).':
    'Aktion durch Geschäftsregel abgelehnt (abgelaufenes Abo, Kontingent erreicht usw.).',
  'A document with this ISBN already exists.': 'Ein Titel mit dieser ISBN existiert bereits.',
  'A copy with this barcode already exists.': 'Ein Exemplar mit diesem Barcode existiert bereits.',
  'Error during Z39.50 search.': 'Fehler bei der Z39.50-Suche.',
  'Database error. Please try again later.':
    'Datenbankfehler. Bitte versuchen Sie es später erneut.',
  'Internal server error. Please try again later.':
    'Interner Serverfehler. Bitte versuchen Sie es später erneut.',
  'Too many attempts. Please wait before trying again.':
    'Zu viele Versuche. Bitte warten Sie, bevor Sie es erneut versuchen.',
  'Juvenile': 'Kinder/Jugend',
  'Preschool': 'Vorschule',
  'Primary': 'Grundschule',
  'Young adult': 'Junge Erwachsene',
  'Adult (serious reading)': 'Erwachsene (anspruchsvolle Literatur)',
  'General audience': 'Allgemeines Publikum',
  'Specialized': 'Spezialisiert',
  'Scientific advisor': 'Wissenschaftlicher Berater',
  'Author of preface': 'Verfasser des Vorworts',
  'Publishing director': 'Verlagsleitung',
  'Fines': 'Gebühren',
  'No fines.': 'Keine Gebühren.',
  'Total unpaid': 'Gesamt offen',
  'Status': 'Status',
  'Pay': 'Bezahlen',
  'Waive': 'Erlassen',
  'Pending': 'Ausstehend',
  'Partial': 'Teilweise',
  'Paid': 'Bezahlt',
  'Waived': 'Erlassen',
  'Active holds': 'Aktive Vorbestellungen',
  '{{total}} active hold(s)': '{{total}} aktive Vorbestellung(en)',
  'New hold': 'Neue Vorbestellung',
  'No active holds.': 'Keine aktiven Vorbestellungen.',
  'Active holds (pending or ready for pickup)':
    'Aktive Vorbestellungen (wartend oder abholbereit)',
  'Hold management': 'Vorbestellungsverwaltung',
  'Place hold': 'Vorbestellen',
  'Confirm hold': 'Vorbestellung bestätigen',
  'Notes (optional)': 'Anmerkungen (optional)',
  'Could not create the hold.': 'Vorbestellung konnte nicht erstellt werden.',
  'Select a patron.': 'Bitte einen Benutzer auswählen.',
  'Hold for': 'Vorbestellung für',
  'For me': 'Für mich',
  'For a patron': 'Für einen Benutzer',
  'Selected patron': 'Ausgewählter Benutzer',
  'This copy is currently on loan. You will be notified when it is available for you.':
    'Dieses Exemplar ist ausgeliehen. Sie werden benachrichtigt, wenn es für Sie verfügbar ist.',
  'Other holds are in the queue ({{count}} waiting). You will be notified in turn; your position will be about {{position}}.':
    'Weitere Vorbestellungen in der Warteschlange ({{count}} wartend). Sie werden der Reihe nach benachrichtigt; Ihre Position ist etwa {{position}}.',
  'You will be notified when the copy is available for you.':
    'Sie werden benachrichtigt, wenn das Exemplar für Sie bereitsteht.',
  'Search a bibliographic record (title, author, ISBN…)':
    'Titel suchen (Titel, Autor, ISBN …)',
  'Copy': 'Exemplar',
  "Patron's holds": 'Vorbestellungen eines Benutzers',
  'Copy hold queue': 'Warteschlange für dieses Exemplar',
  'Search a patron': 'Benutzer suchen',
  'Show': 'Anzeigen',
  'Patron': 'Benutzer',
  'Document': 'Dokument',
  'Copy (ID)': 'Exemplar (ID)',
  'Cancel hold': 'Vorbestellung stornieren',
  'Cancel this hold?': 'Diese Vorbestellung stornieren?',
  'Created': 'Erstellt am',
  'Expires': 'Läuft ab am',
  'No holds.': 'Keine Vorbestellungen.',
  'Position': 'Position',
  'Notes': 'Anmerkungen',
  'Bibliographic record': 'Titeldatensatz',
  'Ready for pickup': 'Abholbereit',
  'Fulfilled': 'Erfüllt',
  'Cancelled': 'Storniert',
  'Expired': 'Abgelaufen',
  'Reading history': 'Leseverlauf',
  'Keep reading history': 'Leseverlauf speichern',
  'When enabled, your past loans are kept for personal use. You can turn this off at any time.':
    'Wenn aktiviert, werden vergangene Ausleihen für Sie gespeichert. Sie können dies jederzeit deaktivieren.',
  'Enable': 'Aktivieren',
  'Disable': 'Deaktivieren',
  'Catalog': 'Katalog',
  'Bibliographic records': 'Titeldatensätze',
  'Collections': 'Sammlungen',
  'Series': 'Serien',
  'Name': 'Name',
  'Secondary title': 'Nebentitel',
  'Tertiary title': 'Dritter Titel',
  '{{count}} collection(s)': '{{count}} Sammlung(en)',
  'No collections.': 'Keine Sammlungen.',
  'New collection': 'Neue Sammlung',
  'Edit collection': 'Sammlung bearbeiten',
  'Delete collection “{{name}}”? This cannot be undone.':
    'Sammlung „{{name}}“ löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
  'Search by name or identifier (UUID)…': 'Nach Name oder Kennung (UUID) suchen …',
  '{{count}} series': '{{count}} Serie(n)',
  'No series.': 'Keine Serien.',
  'New series': 'Neue Serie',
  'Edit series': 'Serie bearbeiten',
  'Delete series “{{name}}”? This cannot be undone.':
    'Serie „{{name}}“ löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
  'Key': 'Schlüssel',
  'No.': 'Nr.',
  'will be created': 'wird angelegt',
  'Use “{{name}}” (create if missing)': '„{{name}}“ verwenden (anlegen falls fehlend)',
  'Search or enter a collection…': 'Sammlung suchen oder eingeben …',
  'Search or enter a series…': 'Serie suchen oder eingeben …',
  'Filtered by:': 'Gefiltert nach:',
  'Clear filter': 'Filter zurücksetzen',
  'Show matching documents in the catalog':
    'Passende Titel im Katalog anzeigen',
  'Task pending…': 'Aufgabe ausstehend …',
  'Task running…': 'Aufgabe läuft …',
  'Task completed': 'Aufgabe abgeschlossen',
  'Task failed': 'Aufgabe fehlgeschlagen',
  'Progress': 'Fortschritt',
  '{{imported}} record(s) imported, {{failed}} failure(s).':
    '{{imported}} Titel importiert, {{failed}} Fehler.',
};

function applyEnFlat() {
  const raw = fs.readFileSync(path.join(localesDir, 'en/translation.json'), 'utf8');
  const obj = JSON.parse(raw);
  for (const [k, v] of Object.entries(enFlat)) {
    setNested(obj, k, v);
  }
  fs.writeFileSync(path.join(localesDir, 'en/translation.json'), JSON.stringify(obj, null, 2) + '\n');
}

function applyEsDeFromEn() {
  const fr = flatten(JSON.parse(fs.readFileSync(path.join(localesDir, 'fr/translation.json'), 'utf8')));
  const en = flatten(JSON.parse(fs.readFileSync(path.join(localesDir, 'en/translation.json'), 'utf8')));

  for (const locale of ['es', 'de']) {
    const filePath = path.join(localesDir, `${locale}/translation.json`);
    const locObj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const locFlat = flatten(locObj);
    const map = locale === 'es' ? esByEn : deByEn;
    for (const k of Object.keys(locFlat)) {
      if (typeof locFlat[k] !== 'string') continue;
      if (locFlat[k] !== fr[k]) continue;
      const enVal = en[k];
      if (typeof enVal !== 'string') continue;
      if (enVal === fr[k]) continue;
      const translated = map[enVal];
      locFlat[k] = translated !== undefined ? translated : enVal;
    }
    const merged = unflatten(locFlat);
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n');
  }
}

applyEnFlat();
applyEsDeFromEn();

console.log('Applied EN overrides and ES/DE translations from EN where value matched FR.');
