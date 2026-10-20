"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  Clock3,
  LayoutDashboard,
  LogOut,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Stethoscope,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { apiRequest, type PortalUser } from "../../lib/api";

type AdminSection = "dashboard" | "appointments" | "doctors" | "patients" | "schedules";
type AppointmentStatus = "booked" | "cancelled";

type AdminSummary = {
  patients: number;
  doctors: number;
  upcoming_appointments: number;
  appointments_today: number;
  recent_appointments: AdminAppointment[];
};

type AdminAppointment = {
  id: number;
  patient: number;
  patient_name: string;
  doctor: number;
  doctor_name: string;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  cancellation_reason: string;
  cancelled_at: string | null;
};

type AdminDoctor = {
  id: number;
  name: string;
  specialty: string;
  active: boolean;
  weekly_schedules: AdminSchedule[];
};

type AdminPatient = {
  id: number;
  username: string;
  role: "patient";
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string | null;
  emergency_contact: string;
  is_active: boolean;
};

type AdminSchedule = {
  id: number;
  doctor: number;
  weekday: number;
  start_time: string;
  end_time: string;
};

const weekdayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const navItems: Array<{ id: AdminSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "appointments", label: "Appointments", icon: CalendarDays },
  { id: "doctors", label: "Doctors", icon: Stethoscope },
  { id: "patients", label: "Patients", icon: UsersRound },
  { id: "schedules", label: "Doctor schedules", icon: Clock3 },
];

function formatVisitDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: "Africa/Nairobi",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function displayPatientName(patient: AdminPatient) {
  return `${patient.first_name} ${patient.last_name}`.trim() || patient.username;
}

export default function AdminPortal({
  user,
  onLogout,
}: {
  user: PortalUser;
  onLogout: () => void;
}) {
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [appointmentFilter, setAppointmentFilter] = useState("all");
  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  const [patients, setPatients] = useState<AdminPatient[]>([]);
  const [schedules, setSchedules] = useState<AdminSchedule[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);
  const [doctorModal, setDoctorModal] = useState<AdminDoctor | "new" | null>(null);
  const [scheduleModal, setScheduleModal] = useState<AdminSchedule | "new" | null>(null);
  const [cancelAppointment, setCancelAppointment] = useState<AdminAppointment | null>(null);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    if (section === "dashboard") {
      return { kind: "dashboard", data: await apiRequest<AdminSummary>("accounts/admin/summary/") } as const;
    }
    if (section === "appointments") {
      const query = appointmentFilter === "all" ? "" : `?status=${appointmentFilter}`;
      return { kind: "appointments", data: await apiRequest<AdminAppointment[]>(`appointments/admin/${query}`) } as const;
    }
    if (section === "doctors") {
      return { kind: "doctors", data: await apiRequest<AdminDoctor[]>("doctors/admin/doctors/") } as const;
    }
    if (section === "patients") {
      return { kind: "patients", data: await apiRequest<AdminPatient[]>("accounts/admin/patients/") } as const;
    }
    const [doctorData, scheduleData] = await Promise.all([
      apiRequest<AdminDoctor[]>("doctors/admin/doctors/"),
      apiRequest<AdminSchedule[]>("doctors/admin/schedules/"),
    ]);
    return { kind: "schedules", doctors: doctorData, schedules: scheduleData } as const;
  }, [appointmentFilter, section]);

  useEffect(() => {
    let mounted = true;
    loadData()
      .then((result) => {
        if (!mounted) return;
        setError("");
        if (result.kind === "dashboard") setSummary(result.data);
        if (result.kind === "appointments") setAppointments(result.data);
        if (result.kind === "doctors") setDoctors(result.data);
        if (result.kind === "patients") setPatients(result.data);
        if (result.kind === "schedules") {
          setDoctors(result.doctors);
          setSchedules(result.schedules);
        }
      })
      .catch((loadError: Error) => {
        if (mounted) setError(loadError.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [loadData, refreshCount]);

  function reloadData() {
    setLoading(true);
    setError("");
    setRefreshCount((count) => count + 1);
  }

  function navigate(next: AdminSection) {
    setLoading(true);
    setSection(next);
    setMobileNavOpen(false);
    setError("");
  }

  async function submitDoctor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    setBusy(true);
    try {
      const editingDoctor = doctorModal !== "new" ? doctorModal : null;
      const payload = editingDoctor
        ? { ...values, active: form.get("active") === "on" }
        : values;
      await apiRequest(
        editingDoctor ? `doctors/admin/doctors/${editingDoctor.id}/` : "doctors/admin/doctors/",
        { method: editingDoctor ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
      setDoctorModal(null);
      reloadData();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleDoctor(doctor: AdminDoctor) {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`doctors/admin/doctors/${doctor.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ active: !doctor.active }),
      });
      reloadData();
    } catch (deleteError) {
      setError((deleteError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function togglePatient(patient: AdminPatient) {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`accounts/admin/patients/${patient.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !patient.is_active }),
      });
      reloadData();
    } catch (updateError) {
      setError((updateError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setBusy(true);
    try {
      const editingSchedule = scheduleModal !== "new" ? scheduleModal : null;
      await apiRequest(
        editingSchedule ? `doctors/admin/schedules/${editingSchedule.id}/` : "doctors/admin/schedules/",
        { method: editingSchedule ? "PATCH" : "POST", body: JSON.stringify(values) },
      );
      setScheduleModal(null);
      reloadData();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteSchedule(schedule: AdminSchedule) {
    if (!window.confirm("Delete this weekly schedule?")) return;
    setBusy(true);
    try {
      await apiRequest(`doctors/admin/schedules/${schedule.id}/`, { method: "DELETE" });
      reloadData();
    } catch (deleteError) {
      setError((deleteError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCancellation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cancelAppointment) return;
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    setBusy(true);
    setError("");
    try {
      await apiRequest(`appointments/admin/${cancelAppointment.id}/cancel/`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setCancelAppointment(null);
      reloadData();
    } catch (cancelError) {
      setError((cancelError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const activeLabel = navItems.find((item) => item.id === section)?.label ?? "Overview";
  const metrics = [
    { label: "Registered patients", value: summary?.patients, icon: UsersRound },
    { label: "Active doctors", value: summary?.doctors, icon: Stethoscope },
    { label: "Appointments today", value: summary?.appointments_today, icon: CalendarDays },
    { label: "Upcoming appointments", value: summary?.upcoming_appointments, icon: Activity },
  ];

  return (
    <main className={`portal-shell admin-shell${collapsed ? " sidebar-collapsed" : ""}`}>
      <aside className={`sidebar admin-sidebar${mobileNavOpen ? " open" : ""}`}>
        <div className="admin-brand-row">
          <Link className="brand portal-brand" href="/" aria-label="Sana Clinic home">
            <span className="brand-mark" aria-hidden="true"><span /><span /></span>
            <span className="admin-brand-name">sana<span className="brand-light">clinic</span></span>
          </Link>
          <button className="admin-collapse-button" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}>
            <ChevronLeft size={17} />
          </button>
        </div>
        <div className="sidebar-caption">ADMINISTRATION</div>
        <nav className="admin-nav" aria-label="Administration pages">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              title={collapsed ? label : undefined}
              aria-current={section === id ? "page" : undefined}
              className={section === id ? "selected" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={17} /><span className="admin-nav-label">{label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-help">
          <strong>Administrator access</strong>
          <p>Management actions are protected by your Django staff permissions.</p>
        </div>
        <button className="logout-button" onClick={onLogout}><LogOut size={16} /><span className="admin-logout-label">Sign out</span></button>
      </aside>

      <div className="portal-main">
        <header className="portal-header">
          <button className="mobile-menu" type="button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={19} /></button>
          <div className="breadcrumb"><span>Sana Clinic</span><b>/</b><strong>{activeLabel}</strong></div>
          <div className="header-patient">
            <div className="header-patient-copy"><strong>{user.first_name || user.username}</strong><span>Administrator</span></div>
            <div className="avatar">{user.first_name?.[0]?.toUpperCase() ?? user.username[0]?.toUpperCase() ?? "A"}</div>
          </div>
        </header>

        <div className="portal-content admin-content">
          <section className="page-intro admin-intro">
            <div>
              <p className="eyebrow"><span /> {section === "dashboard" ? "CLINIC OPERATIONS" : "MANAGE CLINIC"}</p>
              <h1>{section === "dashboard" ? `Welcome, ${user.first_name || user.username}.` : activeLabel}</h1>
              <p>{sectionDescription(section)}</p>
            </div>
            <div className="admin-intro-actions">
              {section === "doctors" && <button className="primary-action" type="button" onClick={() => setDoctorModal("new")}><Plus size={15} /> Add doctor</button>}
              {section === "schedules" && <button className="primary-action" type="button" onClick={() => setScheduleModal("new")} disabled={!doctors.length}><Plus size={15} /> Add schedule</button>}
              <button className="secondary-action" type="button" onClick={reloadData} disabled={loading || busy}>
                <RefreshCw size={15} className={loading ? "admin-spinning" : ""} /> Refresh
              </button>
            </div>
          </section>

          {error && <div className="admin-error" role="alert">{error}</div>}

          {section === "dashboard" && (
            <>
              <section className="stats-grid admin-stats" aria-label="Clinic overview">
                {metrics.map(({ label, value, icon: Icon }) => (
                  <article className="stat-card" key={label}>
                    <span className="stat-icon green"><Icon size={19} /></span>
                    <div><span>{label}</span><strong>{loading && value === undefined ? "—" : value ?? 0}</strong></div>
                  </article>
                ))}
              </section>
              <div className="content-columns admin-columns">
                <section className="content-card admin-activity">
                  <div className="section-heading"><div><h2>Recent appointments</h2><p>Latest scheduled visits</p></div><CalendarDays size={18} /></div>
                  {summary?.recent_appointments.length ? (
                    <div className="admin-appointment-list">
                      {summary.recent_appointments.map((appointment) => <AppointmentSummary key={appointment.id} appointment={appointment} />)}
                    </div>
                  ) : <div className="admin-empty">{loading ? "Loading appointment activity…" : "No appointment activity is available yet."}</div>}
                  <button className="text-action admin-view-all" type="button" onClick={() => navigate("appointments")}>Manage appointments <span>→</span></button>
                </section>
                <section className="content-card admin-management">
                  <div className="section-heading"><div><h2>Management</h2><p>Clinic records and schedules</p></div></div>
                  <div className="admin-link-list">
                    {navItems.filter((item) => item.id !== "dashboard").map((item) => {
                      const Icon = item.icon;
                      return <button key={item.id} type="button" onClick={() => navigate(item.id)}><span><Icon size={15} />{item.label}</span><span>→</span></button>;
                    })}
                  </div>
                </section>
              </div>
            </>
          )}

          {section === "appointments" && (
            <section className="content-card admin-table-card">
              <div className="admin-table-toolbar">
                <div><h2>Appointment records</h2><p>{appointments.length} {appointments.length === 1 ? "record" : "records"}</p></div>
                <label className="admin-filter">Status
                  <select value={appointmentFilter} onChange={(event) => { setLoading(true); setAppointmentFilter(event.target.value); }}>
                    <option value="all">All appointments</option><option value="booked">Booked</option><option value="cancelled">Cancelled</option>
                  </select>
                </label>
              </div>
              {loading ? <AdminLoading /> : appointments.length ? (
                <div className="admin-table-wrap"><table className="admin-table">
                  <thead><tr><th>Patient</th><th>Doctor</th><th>Date and time (EAT)</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>{appointments.map((appointment) => (
                    <tr key={appointment.id}>
                      <td>{appointment.patient_name}</td><td>{appointment.doctor_name}</td><td>{formatVisitDate(appointment.start_at)}</td>
                      <td><StatusPill status={appointment.status} /></td>
                      <td>{appointment.status === "booked" && new Date(appointment.start_at) > new Date() ? <button className="row-action cancel-action" type="button" onClick={() => setCancelAppointment(appointment)}>Cancel</button> : <span className="admin-muted">{appointment.cancellation_reason || "—"}</span>}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              ) : <AdminEmpty message="No appointments match this filter." />}
            </section>
          )}

          {section === "doctors" && (
            <section className="content-card admin-table-card">
              <div className="admin-table-toolbar"><div><h2>Doctor directory</h2><p>{doctors.length} doctors · Deactivated records remain available for appointment history.</p></div></div>
              {loading ? <AdminLoading /> : doctors.length ? (
                <div className="admin-table-wrap"><table className="admin-table">
                  <thead><tr><th>Doctor</th><th>Specialty</th><th>Weekly periods</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>{doctors.map((doctor) => (
                    <tr key={doctor.id}>
                      <td>{doctor.name}</td><td>{doctor.specialty || "General practice"}</td><td>{doctor.weekly_schedules.length}</td>
                      <td><StatusPill status={doctor.active ? "active" : "inactive"} /></td>
                      <td className="admin-row-actions">
                        <button className="row-action" type="button" onClick={() => setDoctorModal(doctor)}><Pencil size={13} /> Edit</button>
                        <button className={`row-action ${doctor.active ? "cancel-action" : ""}`} type="button" onClick={() => void toggleDoctor(doctor)} disabled={busy}>{doctor.active ? "Deactivate" : "Reactivate"}</button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table></div>
              ) : <AdminEmpty message="No doctors have been added yet." />}
            </section>
          )}

          {section === "patients" && (
            <section className="content-card admin-table-card">
              <div className="admin-table-toolbar"><div><h2>Patient directory</h2><p>{patients.length} registered patients</p></div></div>
              {loading ? <AdminLoading /> : patients.length ? (
                <div className="admin-table-wrap"><table className="admin-table">
                  <thead><tr><th>Patient</th><th>Email</th><th>Phone</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>{patients.map((patient) => (
                    <tr key={patient.id}>
                      <td><strong>{displayPatientName(patient)}</strong><small>@{patient.username}</small></td><td>{patient.email}</td><td>{patient.phone || "—"}</td>
                      <td><StatusPill status={patient.is_active ? "active" : "inactive"} /></td>
                      <td><button className={`row-action ${patient.is_active ? "cancel-action" : ""}`} type="button" onClick={() => void togglePatient(patient)} disabled={busy}>{patient.is_active ? "Deactivate" : "Reactivate"}</button></td>
                    </tr>
                  ))}</tbody>
                </table></div>
              ) : <AdminEmpty message="No patients have registered yet." />}
            </section>
          )}

          {section === "schedules" && (
            <section className="content-card admin-table-card">
              <div className="admin-table-toolbar"><div><h2>Weekly doctor schedules</h2><p>Recurring working periods used to generate bookable slots.</p></div></div>
              {loading ? <AdminLoading /> : schedules.length ? (
                <div className="admin-table-wrap"><table className="admin-table">
                  <thead><tr><th>Doctor</th><th>Weekday</th><th>Working hours</th><th>Actions</th></tr></thead>
                  <tbody>{schedules.map((schedule) => (
                    <tr key={schedule.id}>
                      <td>{doctors.find((doctor) => doctor.id === schedule.doctor)?.name ?? `Doctor ${schedule.doctor}`}</td>
                      <td>{weekdayNames[schedule.weekday]}</td><td>{formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}</td>
                      <td className="admin-row-actions">
                        <button className="row-action" type="button" onClick={() => setScheduleModal(schedule)}><Pencil size={13} /> Edit</button>
                        <button className="row-action cancel-action" type="button" onClick={() => void deleteSchedule(schedule)} disabled={busy}><Trash2 size={13} /> Delete</button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table></div>
              ) : <AdminEmpty message="No weekly schedules have been configured." />}
            </section>
          )}

          <p className="timezone-note"><CalendarDays size={14} /> Clinic activity is shown in East Africa Time (EAT), Africa/Nairobi.</p>
        </div>
        <footer className="portal-footer"><span>© 2026 Sana Clinic</span><span>Clinic administration · Africa/Nairobi</span></footer>
      </div>

      {mobileNavOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      {doctorModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDoctorModal(null); }}>
          <section className="cancel-modal admin-edit-modal" role="dialog" aria-modal="true" aria-labelledby="doctor-modal-title">
            <button className="modal-close" aria-label="Close dialog" onClick={() => setDoctorModal(null)}><X size={18} /></button>
            <h2 id="doctor-modal-title">{doctorModal === "new" ? "Add doctor" : "Edit doctor"}</h2>
            {error && <div className="admin-error" role="alert">{error}</div>}
            <form className="admin-edit-form" onSubmit={submitDoctor}>
              <label className="field-label">Name<input name="name" required defaultValue={doctorModal === "new" ? "" : doctorModal.name} /></label>
              <label className="field-label">Specialty<input name="specialty" defaultValue={doctorModal === "new" ? "" : doctorModal.specialty} /></label>
              {doctorModal !== "new" && <label className="admin-checkbox"><input type="checkbox" name="active" defaultChecked={doctorModal.active} /> Active and bookable</label>}
              <div className="modal-actions"><button type="button" className="secondary-action" onClick={() => setDoctorModal(null)} disabled={busy}>Close</button><button className="primary-action" type="submit" disabled={busy}>{busy ? "Saving…" : "Save doctor"}</button></div>
            </form>
          </section>
        </div>
      )}
      {scheduleModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setScheduleModal(null); }}>
          <section className="cancel-modal admin-edit-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title">
            <button className="modal-close" aria-label="Close dialog" onClick={() => setScheduleModal(null)}><X size={18} /></button>
            <h2 id="schedule-modal-title">{scheduleModal === "new" ? "Add weekly schedule" : "Edit weekly schedule"}</h2>
            {error && <div className="admin-error" role="alert">{error}</div>}
            <form className="admin-edit-form" onSubmit={submitSchedule}>
              <label className="field-label">Doctor<select name="doctor" required defaultValue={scheduleModal === "new" ? "" : String(scheduleModal.doctor)}><option value="" disabled>Select doctor</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></label>
              <label className="field-label">Weekday<select name="weekday" required defaultValue={scheduleModal === "new" ? "" : String(scheduleModal.weekday)}><option value="" disabled>Select weekday</option>{weekdayNames.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
              <div className="admin-time-fields">
                <label className="field-label">Start time<input name="start_time" type="time" step="1800" required defaultValue={scheduleModal === "new" ? "" : formatTime(scheduleModal.start_time)} /></label>
                <label className="field-label">End time<input name="end_time" type="time" step="1800" required defaultValue={scheduleModal === "new" ? "" : formatTime(scheduleModal.end_time)} /></label>
              </div>
              <p className="admin-note">Schedule periods must align to 30-minute increments.</p>
              <div className="modal-actions"><button type="button" className="secondary-action" onClick={() => setScheduleModal(null)} disabled={busy}>Close</button><button className="primary-action" type="submit" disabled={busy}>{busy ? "Saving…" : "Save schedule"}</button></div>
            </form>
          </section>
        </div>
      )}
      {cancelAppointment && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setCancelAppointment(null); }}>
          <section className="cancel-modal admin-edit-modal" role="dialog" aria-modal="true" aria-labelledby="admin-cancel-title">
            <button className="modal-close" aria-label="Close dialog" onClick={() => setCancelAppointment(null)}><X size={18} /></button>
            <h2 id="admin-cancel-title">Cancel appointment?</h2>
            <p>{cancelAppointment.patient_name} with {cancelAppointment.doctor_name} · {formatVisitDate(cancelAppointment.start_at)} EAT</p>
            {error && <div className="admin-error" role="alert">{error}</div>}
            <form onSubmit={submitCancellation}>
              <label className="field-label">Cancellation reason<textarea name="reason" rows={3} maxLength={500} required placeholder="Reason for cancelling…" /></label>
              <div className="modal-actions"><button type="button" className="secondary-action" onClick={() => setCancelAppointment(null)} disabled={busy}>Keep appointment</button><button className="danger-action" type="submit" disabled={busy}>{busy ? "Cancelling…" : "Cancel appointment"}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function sectionDescription(section: AdminSection) {
  const descriptions: Record<AdminSection, string> = {
    dashboard: "Review clinic activity and manage your care team.",
    appointments: "Review bookings and cancel appointments when needed.",
    doctors: "Add, update, and remove doctors in the clinic directory.",
    patients: "Review registered patients and manage account access.",
    schedules: "Configure the weekly working periods used for appointment availability.",
  };
  return descriptions[section];
}

function AppointmentSummary({ appointment }: { appointment: AdminAppointment }) {
  return (
    <article className="admin-appointment">
      <div className="admin-appointment-icon"><CalendarDays size={16} /></div>
      <div className="admin-appointment-copy">
        <strong>{appointment.patient_name}</strong>
        <span>with {appointment.doctor_name}</span>
        <time dateTime={appointment.start_at}>{formatVisitDate(appointment.start_at)} EAT</time>
      </div>
      <StatusPill status={appointment.status} />
    </article>
  );
}

function StatusPill({ status }: { status: string }) {
  const className = status === "booked" || status === "active"
    ? "status-booked"
    : status === "cancelled"
      ? "status-cancelled"
      : "admin-status-inactive";
  const label = status === "booked" ? "Booked" : status === "cancelled" ? "Cancelled" : status === "active" ? "Active" : "Inactive";
  return <span className={`appointment-status admin-status ${className}`}><span />{label}</span>;
}

function AdminLoading() {
  return <div className="admin-empty" role="status">Loading records…</div>;
}

function AdminEmpty({ message }: { message: string }) {
  return <div className="admin-empty">{message}</div>;
}
