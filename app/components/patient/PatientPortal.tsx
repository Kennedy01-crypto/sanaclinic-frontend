"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  HeartPulse,
  History,
  LogOut,
  Menu,
  Plus,
  Settings,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AdminPortal from "../admin/AdminPortal";
import { apiRequest, type ApiFailure, type PortalUser } from "../../lib/api";

type Mode = "login" | "register";
type Page = "overview" | "book" | "reschedule" | "appointments" | "profile";

type Patient = PortalUser;

type Doctor = {
  id: number;
  name: string;
  specialty: string;
  active: boolean;
  weekly_schedules: Array<{
    id: number;
    weekday: number;
    start_time: string;
    end_time: string;
  }>;
};

type Appointment = {
  id: number;
  doctor: number;
  patient: number;
  start_at: string;
  end_at: string;
  status: "booked" | "cancelled";
  cancellation_reason: string;
  cancelled_at: string | null;
};

type AvailabilitySlot = {
  start_at: string;
  status: "available" | "booked" | "unavailable";
};
type AvailabilityDay = { date: string; slots: AvailabilitySlot[] };

const CLINIC_TIME_ZONE = "Africa/Nairobi";
const MONTH_NAMES = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2020, month, 1)),
  ),
);

function clinicToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function formatAppointmentDate(value: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("en", {
    timeZone: CLINIC_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  }).format(new Date(value));
}

function formatAppointmentTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: CLINIC_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getInitials(patient: Patient) {
  return `${patient.first_name?.[0] ?? patient.username[0] ?? "P"}${patient.last_name?.[0] ?? ""}`.toUpperCase();
}

function getAppointmentDateKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function getMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

function formatCalendarDate(dateKey: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateKey}T00:00:00Z`));
}

export default function PatientPortal() {
  const [mode, setMode] = useState<Mode>("login");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [page, setPage] = useState<Page>("overview");
  const [authChecked, setAuthChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [today, setToday] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [visibleMonth, setVisibleMonth] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [availabilityMonths, setAvailabilityMonths] = useState<
    Record<string, AvailabilityDay[]>
  >({});
  const [availabilityMonthError, setAvailabilityMonthError] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [slotPickerOpen, setSlotPickerOpen] = useState(false);
  const [rescheduleId, setRescheduleId] = useState<number | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const upcomingAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          appointment.status === "booked" &&
          currentTime > 0 && new Date(appointment.start_at).getTime() > currentTime,
      ),
    [appointments, currentTime],
  );
  const historyAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          appointment.status !== "booked" ||
          currentTime > 0 && new Date(appointment.start_at).getTime() <= currentTime,
      ),
    [appointments, currentTime],
  );
  const availabilityKey = selectedDoctorId && visibleMonth
    ? `${selectedDoctorId}:${visibleMonth}`
    : "";
  const monthDays = availabilityMonths[availabilityKey] ?? [];
  const selectedDay = monthDays.find((day) => day.date === selectedDate);
  const slots = selectedDay?.slots ?? [];
  const slotsLoading = Boolean(
    patient &&
    selectedDoctorId &&
    visibleMonth &&
    !Object.hasOwn(availabilityMonths, availabilityKey) &&
    availabilityMonthError?.key !== availabilityKey,
  );
  const monthError =
    availabilityMonthError?.key === availabilityKey
      ? availabilityMonthError.message
      : "";
  const visibleMonthCalendar = useMemo(() => {
    if (!visibleMonth) return [];
    const [yearValue, monthValue] = visibleMonth.split("-").map(Number);
    const firstWeekday = new Date(Date.UTC(yearValue, monthValue - 1, 1)).getUTCDay();
    const dayCount = new Date(Date.UTC(yearValue, monthValue, 0)).getUTCDate();
    const cellCount = Math.ceil((firstWeekday + dayCount) / 7) * 7;
    return Array.from({ length: cellCount }, (_, index) => {
      const dayNumber = index - firstWeekday + 1;
      if (dayNumber < 1 || dayNumber > dayCount) return null;
      return `${visibleMonth}-${String(dayNumber).padStart(2, "0")}`;
    });
  }, [visibleMonth]);
  const availableDateCount = monthDays.filter((day) =>
    day.slots.some((slot) => slot.status === "available"),
  ).length;

  const loadPortalData = useCallback(async (currentPatient: Patient) => {
    const [doctorData, appointmentData] = await Promise.all([
      apiRequest<Doctor[]>("doctors/"),
      apiRequest<Appointment[]>(
        `appointments/patients/${currentPatient.id}/appointments/`,
      ),
    ]);
    setDoctors(doctorData);
    setAppointments(appointmentData);
  }, []);

  const loadPatient = useCallback(async () => {
    const currentPatient = await apiRequest<Patient>("accounts/me/");
    setPatient(currentPatient);
    if (currentPatient.role === "patient") {
      await loadPortalData(currentPatient);
    }
  }, [loadPortalData]);

  useEffect(() => {
    const timer = window.setTimeout(() => setCurrentTime(Date.now()), 0);
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    apiRequest<Patient>("accounts/me/")
      .then(async (currentPatient) => {
        if (!mounted) return;
        setPatient(currentPatient);
        if (currentPatient.role !== "patient") return;
        const [doctorData, appointmentData] = await Promise.all([
          apiRequest<Doctor[]>("doctors/"),
          apiRequest<Appointment[]>(
            `appointments/patients/${currentPatient.id}/appointments/`,
          ),
        ]);
        if (mounted) {
          setDoctors(doctorData);
          setAppointments(appointmentData);
        }
      })
      .catch((error: ApiFailure) => {
        if (mounted && error.status !== 401) {
          setPageError(error.message);
        }
      })
      .finally(() => {
        if (mounted) {
          const currentClinicDate = clinicToday();
          setToday(currentClinicDate);
          setVisibleMonth(getMonthKey(currentClinicDate));
          setAuthChecked(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (
      !patient ||
      !selectedDoctorId ||
      !visibleMonth ||
      !["book", "reschedule"].includes(page) ||
      Object.hasOwn(availabilityMonths, availabilityKey)
    ) return;
    let mounted = true;
    apiRequest<AvailabilityDay[]>(
      `doctors/${selectedDoctorId}/availability/month/?month=${encodeURIComponent(visibleMonth)}`,
    )
      .then((days) => {
        if (mounted) {
          setAvailabilityMonthError((current) =>
            current?.key === availabilityKey ? null : current,
          );
          setAvailabilityMonths((current) => ({
            ...current,
            [availabilityKey]: days,
          }));
        }
      })
      .catch((error: ApiFailure) => {
        if (mounted) {
          setAvailabilityMonthError({
            key: availabilityKey,
            message: error.message,
          });
          toast.error(error.message);
        }
      });
    return () => {
      mounted = false;
    };
  }, [
    availabilityKey,
    availabilityMonths,
    page,
    patient,
    selectedDoctorId,
    visibleMonth,
  ]);

  useEffect(() => {
    if (!slotPickerOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSlotPickerOpen(false);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [slotPickerOpen]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());

    try {
      if (mode === "register") {
        await apiRequest("accounts/register/", {
          method: "POST",
          body: JSON.stringify(values),
        });
        setMode("login");
        setAuthSuccess("Your account is ready. Sign in to continue.");
        toast.success("Account created. Please sign in.");
        return;
      }

      await apiRequest("accounts/login/", {
        method: "POST",
        body: JSON.stringify(values),
      });
      await loadPatient();
      setPage("overview");
      toast.success("Signed in successfully.");
    } catch (error) {
      setAuthError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    try {
      await apiRequest("accounts/logout/", { method: "POST" });
    } catch {
      // Clear the local portal state even if the session has already expired.
    }
    setPatient(null);
    setAppointments([]);
    setDoctors([]);
    setPage("overview");
    toast.info("You have been signed out.");
  }

  async function handleBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDoctorId || !selectedSlot) {
      toast.error("Choose a doctor and an available appointment time.");
      return;
    }
    setBusy(true);
    try {
      if (rescheduleId) {
        await apiRequest(`appointments/${rescheduleId}/reschedule/`, {
          method: "PATCH",
          body: JSON.stringify({ start_at: selectedSlot }),
        });
        toast.success("Your appointment has been rescheduled.");
      } else {
        await apiRequest("appointments/", {
          method: "POST",
          body: JSON.stringify({
            doctor_id: Number(selectedDoctorId),
            start_at: selectedSlot,
          }),
        });
        toast.success("Your appointment is confirmed.");
      }
      setAvailabilityMonths({});
      setAvailabilityMonthError(null);
      if (patient) await loadPortalData(patient);
      setRescheduleId(null);
      setSelectedSlot("");
      setPage("appointments");
    } catch (error) {
      toast.error((error as Error).message);
      setAvailabilityMonths((current) => {
        const next = { ...current };
        delete next[availabilityKey];
        return next;
      });
      setAvailabilityMonthError(null);
      setSelectedSlot("");
      if (patient) await loadPortalData(patient);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cancelId || !cancelReason.trim()) {
      toast.error("Please provide a reason for cancelling.");
      return;
    }
    setBusy(true);
    try {
      await apiRequest(`appointments/${cancelId}/cancel/`, {
        method: "PATCH",
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      toast.success("Your appointment has been cancelled.");
      setCancelId(null);
      setCancelReason("");
      setAvailabilityMonths({});
      setAvailabilityMonthError(null);
      if (patient) await loadPortalData(patient);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const profileValues = {
      first_name: String(form.get("first_name") ?? ""),
      last_name: String(form.get("last_name") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      date_of_birth: String(form.get("date_of_birth") ?? "") || null,
      emergency_contact: String(form.get("emergency_contact") ?? ""),
    };
    setBusy(true);
    try {
      await apiRequest("accounts/profile/", {
        method: "PATCH",
        body: JSON.stringify(profileValues),
      });
      setPatient((current) => current ? { ...current, ...profileValues } : current);
      toast.success("Your profile has been updated.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    try {
      await apiRequest("accounts/change-password/", {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      form.reset();
      toast.success("Your password has been changed.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function startReschedule(appointment: Appointment) {
    const appointmentDate = getAppointmentDateKey(appointment.start_at);
    setRescheduleId(appointment.id);
    setSelectedDoctorId(String(appointment.doctor));
    setSelectedDate(appointmentDate);
    setVisibleMonth(getMonthKey(appointmentDate));
    setSelectedSlot("");
    setSlotPickerOpen(false);
    setPage("reschedule");
  }

  function beginBooking() {
    setRescheduleId(null);
    setSelectedDate("");
    setSelectedSlot("");
    setSlotPickerOpen(false);
    setVisibleMonth(getMonthKey(today || clinicToday()));
    setPage("book");
  }

  function changeVisibleMonth(month: string) {
    setVisibleMonth(month);
    setSelectedDate("");
    setSelectedSlot("");
    setSlotPickerOpen(false);
  }

  function chooseCalendarDate(dateKey: string) {
    const day = monthDays.find((item) => item.date === dateKey);
    if (!day?.slots.some((slot) => slot.status === "available")) return;
    setSelectedDate(dateKey);
    setSelectedSlot("");
    setSlotPickerOpen(true);
  }

  const activePage: Page = page === "reschedule" ? "book" : page;
  const selectedDoctor = doctors.find(
    (doctor) => String(doctor.id) === selectedDoctorId,
  );

  if (!authChecked) {
    return (
      <main className="portal-loading">
        <div className="brand-mark"><span /><span /></div>
        <p>Preparing your patient portal…</p>
      </main>
    );
  }

  if (!patient) {
    return (
      <main className="page-shell">
        <ToastContainer position="top-right" autoClose={3500} />
        <header className="topbar">
          <Link className="brand" href="/" aria-label="Sana Clinic home">
            <span className="brand-mark" aria-hidden="true"><span /><span /></span>
            <span>sana<span className="brand-light">clinic</span></span>
          </Link>
          <div className="topbar-note"><span className="status-dot" /><span>Care that fits your life</span></div>
        </header>
        <section className="main-content">
          <div className="welcome-panel">
            <div className="welcome-copy">
              <p className="eyebrow"><span /> YOUR HEALTH, IN GOOD HANDS</p>
              <h1>Good care<br />starts <em>here.</em></h1>
              <p className="welcome-description">Thoughtful care from people who know you. Book your next visit in just a few simple steps.</p>
              <div className="care-note"><span className="care-icon" aria-hidden="true">✳</span><span><strong>Here for your wellbeing</strong><br />A calmer, more personal way to manage your care.</span></div>
            </div>
            <div className="artwork" aria-hidden="true">
              <div className="sun-shape" /><div className="arch-shape"><div className="arch-inner" /></div>
              <div className="plant plant-one"><i /><i /><i /><i /><b /></div><div className="plant plant-two"><i /><i /><i /><b /></div>
              <div className="art-caption"><span>✳</span> A little more human.</div>
            </div>
          </div>
          <section className="auth-card" aria-labelledby="form-title">
            <div className="card-heading">
              <p className="eyebrow">PATIENT PORTAL</p>
              <h2 id="form-title">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
              <p>{mode === "login" ? "Sign in to manage your care and appointments." : "Join us to book and manage your appointments."}</p>
            </div>
            <div className="mode-switch" role="tablist" aria-label="Account access">
              <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setAuthError(""); setAuthSuccess(""); }}>Sign in</button>
              <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setAuthError(""); setAuthSuccess(""); }}>Create account</button>
            </div>
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {mode === "register" && <>
                <label>Full name<span className="name-fields"><input name="first_name" autoComplete="given-name" placeholder="First name" required /><input name="last_name" autoComplete="family-name" placeholder="Last name" required /></span></label>
                <label>Email address<input type="email" name="email" autoComplete="email" placeholder="you@example.com" required /></label>
                <label>Phone number <span className="optional-label">(optional)</span><input name="phone" autoComplete="tel" placeholder="+254 700 000 000" /></label>
              </>}
              <label>Username<input name="username" autoComplete="username" placeholder="Enter your username" required /></label>
              <label>Password<input type="password" name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "login" ? "Enter your password" : "At least 8 characters"} minLength={mode === "register" ? 8 : undefined} required /></label>
              {authError && <p className="form-message error" role="alert">{authError}</p>}
              {authSuccess && <p className="form-message success" role="status">{authSuccess}</p>}
              {pageError && <p className="form-message error" role="alert">{pageError}</p>}
              <button className="submit-button" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}{!busy && <span aria-hidden="true">↗</span>}</button>
            </form>
            <p className="form-footnote">By continuing, you agree to use this portal for appointment management only.</p>
          </section>
        </section>
        <footer className="page-footer"><span>© 2026 Sana Clinic</span><span>Clinic hours shown in East Africa Time (EAT)</span><span>Care, made a little simpler <b>✳</b></span></footer>
      </main>
    );
  }

  if (patient.role === "admin") {
    return (
      <>
        <ToastContainer position="top-right" autoClose={3500} />
        <AdminPortal user={patient} onLogout={() => void handleLogout()} />
      </>
    );
  }

  return (
    <main className="portal-shell">
      <ToastContainer position="top-right" autoClose={3500} />
      <aside className={`sidebar ${mobileNavOpen ? "open" : ""}`}>
        <Link className="brand portal-brand" href="/" aria-label="Sana Clinic home">
          <span className="brand-mark" aria-hidden="true"><span /><span /></span>
          <span>sana<span className="brand-light">clinic</span></span>
        </Link>
        <div className="sidebar-caption">PATIENT SPACE</div>
        <nav className="side-nav" aria-label="Patient portal">
          <button className={activePage === "overview" ? "selected" : ""} onClick={() => { setPage("overview"); setMobileNavOpen(false); }}><HeartPulse size={18} /> Overview</button>
          <button className={activePage === "book" ? "selected" : ""} onClick={() => { beginBooking(); setMobileNavOpen(false); }}><Plus size={18} /> Book an appointment</button>
          <button className={activePage === "appointments" ? "selected" : ""} onClick={() => { setPage("appointments"); setMobileNavOpen(false); }}><CalendarDays size={18} /> My appointments</button>
          <button className={activePage === "profile" ? "selected" : ""} onClick={() => { setPage("profile"); setMobileNavOpen(false); }}><Settings size={18} /> Profile settings</button>
        </nav>
        <div className="sidebar-help">
          <div className="sidebar-help-icon"><HeartPulse size={18} /></div>
          <strong>Need help?</strong>
          <p>Our clinic team is happy to assist with your visit.</p>
          <span>Mon–Fri · 8:00–17:00 EAT</span>
        </div>
        <button className="logout-button" onClick={handleLogout}><LogOut size={17} /> Sign out</button>
      </aside>

      <div className="portal-main">
        <header className="portal-header">
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(!mobileNavOpen)}>{mobileNavOpen ? <X size={20} /> : <Menu size={20} />}</button>
          <div className="breadcrumb"><span>Patient portal</span><b>/</b><strong>{page === "book" && rescheduleId ? "Reschedule" : pageLabels[activePage]}</strong></div>
          <div className="header-patient">
            <div className="header-patient-copy"><strong>{patient.first_name || patient.username}</strong><span>Patient</span></div>
            <div className="avatar">{getInitials(patient)}</div>
          </div>
        </header>

        <div className="portal-content">
          {pageError && <div className="inline-error" role="alert">{pageError}<button aria-label="Dismiss" onClick={() => setPageError("")}><X size={15} /></button></div>}
          {page === "overview" && (
            <section>
              <div className="page-intro">
                <div><p className="eyebrow"><span /> YOUR CARE, AT A GLANCE</p><h1>Good day, {patient.first_name || patient.username}.</h1><p>Here’s what’s happening with your care.</p></div>
                <button className="primary-action" onClick={beginBooking}><Plus size={17} /> Book a visit</button>
              </div>
              <div className="stats-grid">
                <div className="stat-card"><span className="stat-icon green"><CalendarDays size={19} /></span><div><span>Upcoming visits</span><strong>{upcomingAppointments.length}</strong></div></div>
                <div className="stat-card"><span className="stat-icon sand"><History size={19} /></span><div><span>Past visits</span><strong>{historyAppointments.length}</strong></div></div>
                <div className="stat-card"><span className="stat-icon blue"><Stethoscope size={19} /></span><div><span>Care team</span><strong>{doctors.length}</strong></div></div>
              </div>
              <div className="content-columns">
                <section className="content-card upcoming-card">
                  <div className="section-heading"><div><h2>Upcoming appointments</h2><p>Your next steps in care</p></div><button className="text-action" onClick={() => setPage("appointments")}>View all <span>→</span></button></div>
                  {upcomingAppointments.length ? <div className="appointment-list">{upcomingAppointments.slice(0, 3).map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} currentTime={currentTime} doctor={doctors.find((item) => item.id === appointment.doctor)} onCancel={() => { setCancelId(appointment.id); setCancelReason(""); }} onReschedule={() => startReschedule(appointment)} />)}</div> : <EmptyState title="No upcoming visits" body="When you book an appointment, it will appear here." action="Book a visit" onAction={beginBooking} /> }
                </section>
                <section className="content-card next-visit-card">
                  <div className="section-heading"><div><h2>Your care team</h2><p>Meet the people supporting you</p></div><Stethoscope size={19} /></div>
                  {doctors.length ? <div className="doctor-list">{doctors.slice(0, 4).map((doctor) => <div className="doctor-mini" key={doctor.id}><div className="doctor-avatar">{doctor.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div><strong>{doctor.name}</strong><span>{doctor.specialty || "General practice"}</span></div><span className="doctor-available">Available</span></div>)}</div> : <p className="subtle-copy">The clinic team is updating its schedule. Please check back soon.</p>}
                </section>
              </div>
              <p className="timezone-note"><Clock3 size={14} /> Times are shown in East Africa Time (EAT), Africa/Nairobi.</p>
            </section>
          )}

          {page === "appointments" && (
            <section>
              <div className="page-intro">
                <div><p className="eyebrow"><span /> YOUR VISITS</p><h1>My appointments</h1><p>Review upcoming visits and your appointment history.</p></div>
                <button className="primary-action" onClick={beginBooking}><Plus size={17} /> Book a visit</button>
              </div>
              <section className="content-card appointments-page-card">
                <div className="section-heading"><div><h2>Upcoming</h2><p>{upcomingAppointments.length} active {upcomingAppointments.length === 1 ? "appointment" : "appointments"}</p></div></div>
                {upcomingAppointments.length ? <div className="appointment-list">{upcomingAppointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} currentTime={currentTime} doctor={doctors.find((item) => item.id === appointment.doctor)} onCancel={() => { setCancelId(appointment.id); setCancelReason(""); }} onReschedule={() => startReschedule(appointment)} />)}</div> : <EmptyState title="Nothing scheduled yet" body="Choose a doctor and a time that works for you." action="Find a time" onAction={beginBooking} />}
              </section>
              <section className="content-card appointments-page-card history-card">
                <div className="section-heading"><div><h2>Appointment history</h2><p>Past and cancelled visits</p></div></div>
                {historyAppointments.length ? <div className="appointment-list">{historyAppointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} currentTime={currentTime} doctor={doctors.find((item) => item.id === appointment.doctor)} />)}</div> : <div className="empty-compact"><History size={20} /><span>Your past appointments will show here.</span></div>}
              </section>
            </section>
          )}

          {(page === "book" || page === "reschedule") && (
            <section>
              <div className="page-intro">
                <div><p className="eyebrow"><span /> {rescheduleId ? "CHANGE YOUR VISIT" : "MAKE TIME FOR YOU"}</p><h1>{rescheduleId ? "Reschedule visit" : "Book an appointment"}</h1><p>{rescheduleId ? "Choose a new available time with the same doctor." : "Choose your doctor, a date, and an available time."}</p></div>
                {rescheduleId && <button className="secondary-action" onClick={() => { setRescheduleId(null); setPage("appointments"); }}>Back to appointments</button>}
              </div>
              <form className="content-card booking-card" onSubmit={handleBooking}>
                <div className="booking-step"><span>1</span><div><h2>Choose your doctor</h2><p>Select a member of our care team.</p></div></div>
                <label className="field-label" htmlFor="doctor-select">Doctor</label>
                <div className="select-wrap"><Stethoscope size={17} /><select id="doctor-select" value={selectedDoctorId} onChange={(event) => { setSelectedDoctorId(event.target.value); setSelectedDate(""); setSelectedSlot(""); setSlotPickerOpen(false); }} required disabled={Boolean(rescheduleId)}><option value="">Select a doctor</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}{doctor.specialty ? ` · ${doctor.specialty}` : ""}</option>)}</select><ChevronDown size={16} /></div>
                {selectedDoctor && <div className="schedule-hint"><Clock3 size={15} /> {selectedDoctor.weekly_schedules.length ? "Only the doctor's scheduled 30-minute slots are shown. Booked times cannot be selected." : "No weekly hours are currently configured for this doctor."}</div>}
                <div className="booking-divider" />
                <div className="booking-step"><span>2</span><div><h2>Choose a date</h2><p>Appointments are shown in East Africa Time.</p></div></div>
                <div className="availability-calendar">
                  <div className="calendar-toolbar">
                    <div className="calendar-month-selects">
                      <label className="visually-hidden" htmlFor="calendar-month">Calendar month</label>
                      <select
                        id="calendar-month"
                        value={visibleMonth ? Number(visibleMonth.slice(5, 7)) : ""}
                        disabled={!selectedDoctorId}
                        onChange={(event) => {
                          const year = visibleMonth.slice(0, 4);
                          changeVisibleMonth(`${year}-${String(Number(event.target.value)).padStart(2, "0")}`);
                        }}
                      >
                        {MONTH_NAMES.map((month, index) => (
                          <option key={month} value={index + 1}>{month}</option>
                        ))}
                      </select>
                      <label className="visually-hidden" htmlFor="calendar-year">Calendar year</label>
                      <select
                        id="calendar-year"
                        value={visibleMonth ? Number(visibleMonth.slice(0, 4)) : ""}
                        disabled={!selectedDoctorId}
                        onChange={(event) => {
                          const month = visibleMonth.slice(5, 7);
                          changeVisibleMonth(`${event.target.value}-${month}`);
                        }}
                      >
                        {Array.from({ length: 6 }, (_, index) => Number(today.slice(0, 4)) + index).map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                    <div className="calendar-nav">
                      <button
                        type="button"
                        aria-label="Previous month"
                        disabled={!selectedDoctorId || visibleMonth <= getMonthKey(today)}
                        onClick={() => {
                          const [year, month] = visibleMonth.split("-").map(Number);
                          const previous = new Date(Date.UTC(year, month - 2, 1));
                          changeVisibleMonth(`${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`);
                        }}
                      ><ChevronLeft size={17} /></button>
                      <button
                        type="button"
                        aria-label="Next month"
                        disabled={!selectedDoctorId || visibleMonth >= `${Number(today.slice(0, 4)) + 5}-12`}
                        onClick={() => {
                          const [year, month] = visibleMonth.split("-").map(Number);
                          const next = new Date(Date.UTC(year, month, 1));
                          changeVisibleMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`);
                        }}
                      ><ChevronRight size={17} /></button>
                    </div>
                  </div>
                  <div className="calendar-weekdays" aria-hidden="true">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => <span key={weekday}>{weekday}</span>)}
                  </div>
                  <div className="calendar-days" aria-label="Appointment availability">
                    {visibleMonthCalendar.map((dateKey, index) => {
                      if (!dateKey) return <span className="calendar-day-empty" key={`empty-${index}`} aria-hidden="true" />;
                      const day = monthDays.find((item) => item.date === dateKey);
                      const count = day?.slots.filter((slot) => slot.status === "available").length ?? 0;
                      const isPast = dateKey < today;
                      return (
                        <button
                          className={`calendar-day${count ? ` has-availability availability-${count <= 2 ? "low" : count <= 5 ? "medium" : "high"}` : ""}${selectedDate === dateKey ? " selected" : ""}`}
                          type="button"
                          key={dateKey}
                          disabled={!selectedDoctorId || slotsLoading || isPast || count === 0}
                          aria-label={`${formatCalendarDate(dateKey)}${count ? `, ${count} available ${count === 1 ? "slot" : "slots"}` : ", no appointments available"}`}
                          aria-pressed={selectedDate === dateKey}
                          onClick={() => chooseCalendarDate(dateKey)}
                        >
                          <span>{Number(dateKey.slice(-2))}</span>
                          {count > 0 && <small>{count}</small>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="calendar-footer">
                    {!selectedDoctorId ? (
                      <span>Select a doctor to load available dates.</span>
                    ) : slotsLoading ? (
                      <span role="status">Loading availability…</span>
                    ) : monthError ? (
                      <span className="calendar-error">{monthError}</span>
                    ) : (
                      <span><i className="calendar-available-key" /> Available dates · {availableDateCount} {availableDateCount === 1 ? "day" : "days"} this month</span>
                    )}
                  </div>
                </div>
                <div className="booking-divider" />
                <div className="booking-step"><span>3</span><div><h2>Choose a time</h2><p>Each appointment is 30 minutes.</p></div></div>
                {!selectedDoctorId ? (
                  <div className="slot-placeholder">Select a doctor, then choose an available date.</div>
                ) : slotsLoading ? (
                  <div className="slot-placeholder" role="status">Loading the doctor&apos;s monthly availability…</div>
                ) : monthError ? (
                  <div className="slot-placeholder">{monthError}</div>
                ) : selectedSlot ? (
                  <div className="selected-appointment-time">
                    <div><CalendarDays size={17} /><span><strong>{formatCalendarDate(selectedDate)}</strong><small>{formatAppointmentTime(selectedSlot)} EAT · 30 minutes</small></span></div>
                    <button type="button" onClick={() => setSlotPickerOpen(true)}>Change date or time</button>
                  </div>
                ) : selectedDate ? (
                  <div className="selected-appointment-time">
                    <div><CalendarDays size={17} /><span><strong>{formatCalendarDate(selectedDate)}</strong><small>Select an available time to continue.</small></span></div>
                    <button type="button" onClick={() => setSlotPickerOpen(true)}>Choose a time</button>
                  </div>
                ) : (
                  <div className="slot-placeholder">Choose a highlighted date to see its available 30-minute times.</div>
                )}
                <div className="booking-submit-row"><span><Clock3 size={14} /> Clinic time zone: EAT (UTC+3)</span><button className="primary-action" type="submit" disabled={busy || !selectedSlot}>{busy ? "Saving…" : rescheduleId ? "Confirm new time" : "Confirm appointment"}<span aria-hidden="true">→</span></button></div>
              </form>
              {slotPickerOpen && (
                <div
                  className="modal-backdrop slot-picker-backdrop"
                  onClick={(event) => {
                    if (event.target === event.currentTarget) setSlotPickerOpen(false);
                  }}
                >
                  <section
                    className="slot-picker-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="slot-picker-title"
                  >
                    <button
                      className="modal-close"
                      type="button"
                      autoFocus
                      aria-label="Close time selection"
                      onClick={() => setSlotPickerOpen(false)}
                    ><X size={17} /></button>
                    <div className="modal-icon"><Clock3 size={19} /></div>
                    <h2 id="slot-picker-title">Choose an available time</h2>
                    <p>{formatCalendarDate(selectedDate)} · East Africa Time</p>
                    {slotsLoading ? (
                      <div className="slot-picker-empty" role="status">Loading available times…</div>
                    ) : monthError ? (
                      <div className="slot-picker-empty">{monthError}</div>
                    ) : slots.filter((slot) => slot.status === "available").length ? (
                      <div className="slot-picker-grid">
                        {slots.filter((slot) => slot.status === "available").map((slot) => (
                          <button
                            className={`slot-picker-option${selectedSlot === slot.start_at ? " selected" : ""}`}
                            type="button"
                            key={slot.start_at}
                            onClick={() => {
                              setSelectedSlot(slot.start_at);
                              setSlotPickerOpen(false);
                            }}
                          >
                            <Clock3 size={14} /> {formatAppointmentTime(slot.start_at)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="slot-picker-empty">These times are no longer available. Choose another date.</div>
                    )}
                    <div className="slot-picker-timezone"><Clock3 size={13} /> Appointments are shown in EAT (UTC+3).</div>
                  </section>
                </div>
              )}
            </section>
          )}

          {page === "profile" && (
            <section>
              <div className="page-intro"><div><p className="eyebrow"><span /> YOUR DETAILS</p><h1>Profile settings</h1><p>Keep your contact details up to date.</p></div></div>
              <div className="profile-grid">
                <form className="content-card settings-card" onSubmit={handleProfileSave}>
                  <div className="section-heading"><div><h2>Personal information</h2><p>Only you can view and update these details.</p></div><UserRound size={19} /></div>
                  <div className="settings-form-grid">
                    <label className="field-label">First name<input name="first_name" defaultValue={patient.first_name} required /></label>
                    <label className="field-label">Last name<input name="last_name" defaultValue={patient.last_name} required /></label>
                    <label className="field-label">Email address<input name="email" type="email" defaultValue={patient.email} required /></label>
                    <label className="field-label">Phone number<input name="phone" defaultValue={patient.phone} /></label>
                    <label className="field-label">Date of birth<input name="date_of_birth" type="date" defaultValue={patient.date_of_birth ?? ""} /></label>
                    <label className="field-label">Emergency contact<input name="emergency_contact" defaultValue={patient.emergency_contact} /></label>
                  </div>
                  <div className="form-actions"><span>Username: <strong>{patient.username}</strong> (cannot be changed)</span><button className="primary-action" type="submit" disabled={busy}>Save changes</button></div>
                </form>
                <form className="content-card settings-card password-card" onSubmit={handlePasswordChange}>
                  <div className="section-heading"><div><h2>Change password</h2><p>Choose a strong password you haven’t used elsewhere.</p></div><Settings size={19} /></div>
                  <label className="field-label">Current password<input name="old_password" type="password" autoComplete="current-password" required /></label>
                  <label className="field-label">New password<input name="new_password" type="password" autoComplete="new-password" minLength={8} required /></label>
                  <button className="primary-action" type="submit" disabled={busy}>Update password</button>
                </form>
              </div>
            </section>
          )}
        </div>
        <footer className="portal-footer"><span>© 2026 Sana Clinic</span><span>Care that fits your life · Africa/Nairobi</span></footer>
      </div>

      {mobileNavOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      {cancelId !== null && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setCancelId(null); }}>
          <section className="cancel-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
            <button className="modal-close" aria-label="Close dialog" onClick={() => setCancelId(null)}><X size={18} /></button>
            <div className="modal-icon"><CalendarDays size={20} /></div>
            <h2 id="cancel-title">Cancel this appointment?</h2>
            <p>This will release your appointment time. Please tell us why you need to cancel.</p>
            <form onSubmit={handleCancel}>
              <label className="field-label" htmlFor="cancel-reason">Cancellation reason</label>
              <textarea id="cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={3} maxLength={500} required placeholder="Add a short reason…" />
              <div className="modal-actions"><button type="button" className="secondary-action" disabled={busy} onClick={() => setCancelId(null)}>Keep appointment</button><button type="submit" className="danger-action" disabled={busy || !cancelReason.trim()}>{busy ? "Cancelling…" : "Cancel appointment"}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

const pageLabels: Record<Page, string> = {
  overview: "Overview",
  book: "Book an appointment",
  reschedule: "Reschedule visit",
  appointments: "My appointments",
  profile: "Profile settings",
};

function AppointmentRow({
  appointment,
  doctor,
  currentTime,
  onCancel,
  onReschedule,
}: {
  appointment: Appointment;
  doctor?: Doctor;
  currentTime: number;
  onCancel?: () => void;
  onReschedule?: () => void;
}) {
  const isUpcoming =
    currentTime > 0 &&
    appointment.status === "booked" &&
    new Date(appointment.start_at).getTime() > currentTime;
  return (
    <article className="appointment-row">
      <div className="appointment-date-tile"><strong>{formatAppointmentDate(appointment.start_at, { day: "2-digit" })}</strong><span>{formatAppointmentDate(appointment.start_at, { month: "short" })}</span></div>
      <div className="appointment-details"><div className="appointment-doctor">{doctor?.name ?? `Doctor ${appointment.doctor}`}</div><div className="appointment-specialty">{doctor?.specialty || "Clinic appointment"}</div><div className="appointment-meta"><span><CalendarDays size={13} />{formatAppointmentDate(appointment.start_at, { weekday: "long", year: undefined })}</span><span><Clock3 size={13} />{formatAppointmentTime(appointment.start_at)} – {formatAppointmentTime(appointment.end_at)} EAT</span></div></div>
      <div className={`appointment-status ${isUpcoming ? "status-booked" : appointment.status === "cancelled" ? "status-cancelled" : "status-past"}`}><span />{isUpcoming ? "Confirmed" : appointment.status === "cancelled" ? "Cancelled" : "Completed"}</div>
      {(onCancel || onReschedule) && isUpcoming && <div className="appointment-actions">{onReschedule && <button className="row-action" onClick={onReschedule}>Reschedule</button>}{onCancel && <button className="row-action cancel-action" onClick={onCancel}>Cancel</button>}</div>}
      {appointment.status === "cancelled" && appointment.cancellation_reason && <div className="cancellation-note">Reason: {appointment.cancellation_reason}</div>}
    </article>
  );
}

function EmptyState({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><CalendarDays size={21} /></div>
      <strong>{title}</strong>
      <p>{body}</p>
      <button className="text-action" onClick={onAction}>{action} <span>→</span></button>
    </div>
  );
}
