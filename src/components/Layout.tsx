import React, { useState, useEffect, useRef, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  Bot,
  ClipboardList,
  Trophy,
  LogOut,
  Bell,
  Menu,
  ChevronDown,
  ChevronUp,
  UserRound,
  PencilLine,
  Ruler,
  Droplets,
  Phone,
  HeartPulse,
  ImagePlus,
  X,
} from "lucide-react";
import Dashboard from "./Dashboard";
import NourixAssistant from "./NourixAssistant";
import PlanGenerator from "./PlanGenerator";
import Rewards from "./Rewards";
import { User } from "../utils";
import { requestNotificationPermission } from "../services/notifications";
import { useLiveDashboard } from "../hooks/useLiveDashboard";

interface AppLayoutProps {
  user: User;
  onLogout: () => void;
}

interface HealthProfile {
  photo: string;
  age: string;
  gender: string;
  heightCm: string;
  weightKg: string;
  bloodGroup: string;
  emergencyContact: string;
  medicalConditions: string;
}

const createEmptyProfile = (): HealthProfile => ({
  photo: "",
  age: "",
  gender: "",
  heightCm: "",
  weightKg: "",
  bloodGroup: "",
  emergencyContact: "",
  medicalConditions: "",
});

const getProfileStorageKey = (userId: number) => `nourix_profile_${userId}`;

const loadStoredProfile = (userId: number): HealthProfile => {
  if (typeof window === "undefined") return createEmptyProfile();

  try {
    const saved = window.localStorage.getItem(getProfileStorageKey(userId));
    if (!saved) return createEmptyProfile();
    return { ...createEmptyProfile(), ...JSON.parse(saved) };
  } catch (error) {
    console.error("Failed to load stored profile:", error);
    return createEmptyProfile();
  }
};

const formatValue = (value: string) => value.trim() || "Not added";

const formatAgeGender = (profile: HealthProfile) => {
  const parts = [profile.age ? `${profile.age} yrs` : "", profile.gender].filter(Boolean);
  return parts.length ? parts.join(" / ") : "Not added";
};

const formatHeightWeight = (profile: HealthProfile) => {
  const parts = [
    profile.heightCm ? `${profile.heightCm} cm` : "",
    profile.weightKg ? `${profile.weightKg} kg` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" / ") : "Not added";
};

const formatAbsoluteDate = (value?: string | null) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const Avatar = ({
  name,
  photo,
  className,
  textClassName,
}: {
  name: string;
  photo: string;
  className: string;
  textClassName?: string;
}) => {
  if (photo) {
    return <img src={photo} alt={name} className={`${className} object-cover`} />;
  }

  return (
    <div className={`${className} ${textClassName ?? ""}`}>
      {name[0]?.toUpperCase() ?? "U"}
    </div>
  );
};

export default function AppLayout({ user, onLogout }: AppLayoutProps) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [profile, setProfile] = useState<HealthProfile>(() => loadStoredProfile(user.id));
  const [draftProfile, setDraftProfile] = useState<HealthProfile>(() => loadStoredProfile(user.id));
  const [draftUserName, setDraftUserName] = useState(user.name);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const { dashboard, connectionMode, isSyncing, addSteps, refreshDashboard } = useLiveDashboard(user);
  const liveUser = dashboard.user;
  const points = liveUser.points;
  const profileDrawerRef = useRef<HTMLDivElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const usernameChangeDate = formatAbsoluteDate(liveUser.nameChangeAllowedAt);
  const canChangeName = liveUser.canChangeName !== false;
  const usernameHelperText = canChangeName
    ? "You can change your username now. After saving, the next change unlocks in 30 days."
    : `Username is locked. You can change it again on ${usernameChangeDate ?? "the next available date"}.`;

  useEffect(() => {
    localStorage.setItem("novafit_user", JSON.stringify(liveUser));
  }, [liveUser]);

  useEffect(() => {
    const nextProfile = loadStoredProfile(liveUser.id);
    setProfile(nextProfile);
    setDraftProfile(nextProfile);
    setDraftUserName(liveUser.name);
    setProfileError("");
  }, [liveUser.id]);

  useEffect(() => {
    setDraftUserName(liveUser.name);
  }, [liveUser.name]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!profileDrawerRef.current?.contains(event.target as Node)) {
        setIsProfileDrawerOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!isProfileEditorOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileEditorOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isProfileEditorOpen]);

  useEffect(() => {
    setIsProfileDrawerOpen(false);
  }, [activeTab, isSidebarOpen]);

  const openProfileEditor = () => {
    setDraftProfile(profile);
    setDraftUserName(liveUser.name);
    setProfileError("");
    setIsProfileEditorOpen(true);
    setIsProfileDrawerOpen(false);
  };

  const closeProfileEditor = () => {
    setDraftProfile(profile);
    setDraftUserName(liveUser.name);
    setProfileError("");
    setIsProfileEditorOpen(false);
  };

  const saveProfile = async () => {
    setIsSavingProfile(true);
    setProfileError("");

    try {
      const nextUserName = draftUserName.trim();

      if (nextUserName !== liveUser.name) {
        const response = await fetch(`/api/user/${liveUser.id}/name`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nextUserName }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          setProfileError((data as { error?: string }).error ?? "Failed to update username.");
          return;
        }

        await refreshDashboard();
      }

      setProfile(draftProfile);
      localStorage.setItem(getProfileStorageKey(liveUser.id), JSON.stringify(draftProfile));
      setIsProfileEditorOpen(false);
    } catch (error) {
      console.error("Profile save failed:", error);
      setProfileError("Failed to save profile changes.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleNotificationClick = async () => {
    await requestNotificationPermission();
    setIsProfileDrawerOpen(false);
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setDraftProfile((current) => ({ ...current, photo: result }));
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleProfileFieldChange =
    (field: keyof HealthProfile) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setDraftProfile((current) => ({ ...current, [field]: event.target.value }));
    };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "nourix", label: "Nourix Assistant", icon: Bot },
    { id: "plans", label: "Plan Generator", icon: ClipboardList },
    { id: "rewards", label: "Rewards", icon: Trophy },
  ];

  const profileRows = [
    {
      label: "Username",
      value: liveUser.name,
      caption: canChangeName
        ? "Editable now"
        : `Change again on ${usernameChangeDate ?? "the next available date"}`,
      icon: UserRound,
    },
    { label: "Age / Gender", value: formatAgeGender(profile), icon: UserRound },
    { label: "Height & Weight", value: formatHeightWeight(profile), icon: Ruler },
    { label: "Blood Group", value: formatValue(profile.bloodGroup), icon: Droplets },
    { label: "Emergency Contact", value: formatValue(profile.emergencyContact), icon: Phone },
    {
      label: "Medical Conditions",
      value: formatValue(profile.medicalConditions),
      icon: HeartPulse,
    },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex">
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-black/5 transition-transform duration-300 lg:translate-x-0 lg:static
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center gap-3 mb-12 px-2">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Bot size={24} />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900">Nourix</h1>
          </div>

          <nav className="flex-1 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                  setIsProfileDrawerOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold transition-all
                  ${
                    activeTab === item.id
                      ? "bg-zinc-900 text-white shadow-lg shadow-zinc-900/10"
                      : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                  }
                `}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-black/5">
            <div ref={profileDrawerRef} className="relative">
              <AnimatePresence>
                {isProfileDrawerOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute bottom-full left-0 right-0 mb-3 max-h-[72vh] overflow-y-auto rounded-[28px] border border-black/5 bg-white p-3 shadow-xl shadow-zinc-900/10"
                  >
                    <div className="rounded-[24px] bg-zinc-50 px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                        Profile
                      </p>
                      <div className="mt-3 flex items-center gap-3">
                        <Avatar
                          name={liveUser.name}
                          photo={profile.photo}
                          className="h-14 w-14 shrink-0 rounded-full bg-white"
                          textClassName="flex items-center justify-center font-bold text-zinc-600"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-zinc-900">
                            {liveUser.name}
                          </p>
                          <p className="truncate text-sm text-zinc-500">{liveUser.email}</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={openProfileEditor}
                      className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-left text-sm font-semibold text-zinc-800 transition-all hover:bg-zinc-50"
                    >
                      <PencilLine size={18} />
                      Edit personal info
                    </button>

                    <div className="mt-3 space-y-2">
                      {profileRows.map((item) => (
                        <button
                          key={item.label}
                          onClick={openProfileEditor}
                          className="flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition-all hover:bg-zinc-50"
                        >
                          <item.icon size={18} className="mt-0.5 text-zinc-500" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
                            <p className="mt-1 text-xs text-zinc-500 break-words">{item.value}</p>
                            {"caption" in item && item.caption ? (
                              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                                {item.caption}
                              </p>
                            ) : null}
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="my-3 h-px bg-zinc-100" />

                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setActiveTab("dashboard");
                          setIsSidebarOpen(false);
                          setIsProfileDrawerOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-zinc-700 transition-all hover:bg-zinc-50 hover:text-zinc-900"
                      >
                        <LayoutDashboard size={18} />
                        Dashboard
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab("rewards");
                          setIsSidebarOpen(false);
                          setIsProfileDrawerOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-zinc-700 transition-all hover:bg-zinc-50 hover:text-zinc-900"
                      >
                        <Trophy size={18} />
                        Rewards
                      </button>
                      <button
                        onClick={handleNotificationClick}
                        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-zinc-700 transition-all hover:bg-zinc-50 hover:text-zinc-900"
                      >
                        <Bell size={18} />
                        Notifications
                      </button>
                      <button
                        onClick={onLogout}
                        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-red-500 transition-all hover:bg-red-50"
                      >
                        <LogOut size={18} />
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={() => setIsProfileDrawerOpen((current) => !current)}
                className="flex w-full items-center gap-3 rounded-[28px] px-2 py-2 text-left transition-all hover:bg-zinc-50"
              >
                <Avatar
                  name={liveUser.name}
                  photo={profile.photo}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-100"
                  textClassName="font-bold text-zinc-600"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-zinc-900 truncate">{liveUser.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{liveUser.email}</p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
                  {isProfileDrawerOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-black/5 flex items-center justify-between px-6 lg:px-12 flex-shrink-0">
          <button
            className="lg:hidden p-2 text-zinc-500"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>

          <h2 className="text-xl font-bold text-zinc-900">
            {navItems.find((item) => item.id === activeTab)?.label}
          </h2>

          <div className="flex items-center gap-4">
            <button
              className="p-2 text-zinc-500 hover:text-zinc-900 transition-colors relative"
              onClick={handleNotificationClick}
            >
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-12">
          <div className="max-w-6xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === "dashboard" && (
                  <Dashboard
                    dashboard={dashboard}
                    connectionMode={connectionMode}
                    onAddSteps={addSteps}
                    isSyncing={isSyncing}
                  />
                )}
                {activeTab === "nourix" && <NourixAssistant />}
                {activeTab === "plans" && <PlanGenerator userId={user.id} />}
                {activeTab === "rewards" && <Rewards points={points} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {isProfileEditorOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-sm p-4 md:p-6"
            onClick={closeProfileEditor}
          >
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.2 }}
              onClick={(event) => event.stopPropagation()}
              className="ml-auto flex h-full w-full max-w-2xl flex-col rounded-[32px] bg-white shadow-2xl shadow-zinc-900/20"
            >
              <div className="flex items-center justify-between border-b border-black/5 px-6 py-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
                    Edit Personal Info
                  </p>
                  <h3 className="mt-1 text-2xl font-bold text-zinc-900">Health profile</h3>
                </div>
                <button
                  onClick={closeProfileEditor}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600 transition-all hover:bg-zinc-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="space-y-6">
                  <div className="rounded-[28px] border border-black/5 bg-zinc-50 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
                      Profile
                    </p>
                    <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
                      <Avatar
                        name={liveUser.name}
                        photo={draftProfile.photo}
                        className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm"
                        textClassName="font-bold text-zinc-600"
                      />
                      <div className="flex-1">
                        <p className="text-lg font-semibold text-zinc-900">{liveUser.name}</p>
                        <p className="text-sm text-zinc-500">{liveUser.email}</p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            onClick={() => photoInputRef.current?.click()}
                            className="inline-flex items-center gap-2 rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-zinc-800"
                          >
                            <ImagePlus size={16} />
                            Upload photo
                          </button>
                          {draftProfile.photo && (
                            <button
                              onClick={() =>
                                setDraftProfile((current) => ({ ...current, photo: "" }))
                              }
                              className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition-all hover:bg-white"
                            >
                              Remove photo
                            </button>
                          )}
                          <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhotoChange}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Username
                    </span>
                    <input
                      type="text"
                      value={draftUserName}
                      onChange={(event) => setDraftUserName(event.target.value)}
                      disabled={!canChangeName}
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                      placeholder="chatpriyanshu60"
                    />
                    <p className="mt-2 text-xs text-zinc-500">{usernameHelperText}</p>
                  </label>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Age
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={draftProfile.age}
                        onChange={handleProfileFieldChange("age")}
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        placeholder="24"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Gender
                      </span>
                      <select
                        value={draftProfile.gender}
                        onChange={handleProfileFieldChange("gender")}
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="">Select gender</option>
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Non-binary">Non-binary</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Height
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={draftProfile.heightCm}
                        onChange={handleProfileFieldChange("heightCm")}
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        placeholder="172 cm"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Weight
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={draftProfile.weightKg}
                        onChange={handleProfileFieldChange("weightKg")}
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        placeholder="68 kg"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Blood Group
                      </span>
                      <select
                        value={draftProfile.bloodGroup}
                        onChange={handleProfileFieldChange("bloodGroup")}
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="">Select blood group</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Emergency Contact
                      </span>
                      <input
                        type="text"
                        value={draftProfile.emergencyContact}
                        onChange={handleProfileFieldChange("emergencyContact")}
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        placeholder="+91 98765 43210"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Medical Conditions
                    </span>
                    <textarea
                      rows={5}
                      value={draftProfile.medicalConditions}
                      onChange={handleProfileFieldChange("medicalConditions")}
                      className="w-full rounded-[24px] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      placeholder="Diabetes, BP, allergies, ongoing medications, or anything important to know"
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-black/5 px-6 py-5 sm:flex-row sm:justify-end">
                {profileError ? (
                  <p className="sm:mr-auto text-sm font-medium text-red-500">{profileError}</p>
                ) : null}
                <button
                  onClick={closeProfileEditor}
                  disabled={isSavingProfile}
                  className="rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 transition-all hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveProfile}
                  disabled={isSavingProfile}
                  className="rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-700"
                >
                  {isSavingProfile ? "Saving..." : "Save profile"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
