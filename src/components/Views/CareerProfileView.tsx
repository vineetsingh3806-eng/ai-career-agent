import React, { useState, useEffect } from 'react';
import { UserCheck, Save, CheckCircle2, Sparkles, Compass, MapPin } from 'lucide-react';
import type { CareerProfile } from '../../types';
import { getCareerProfile, updateCareerProfile } from '../../services/api';

export const CareerProfileView: React.FC = () => {
  const [profile, setProfile] = useState<CareerProfile>({
    skills: [],
    preferredLocations: [],
    remotePreference: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [skillInput, setSkillInput] = useState('');

  useEffect(() => {
    getCareerProfile().then(setProfile).catch(console.error);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await updateCareerProfile(profile);
      setProfile(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const addSkill = () => {
    if (!skillInput.trim()) return;
    const current = profile.skills || [];
    if (!current.includes(skillInput.trim())) {
      setProfile({ ...profile, skills: [...current, skillInput.trim()] });
    }
    setSkillInput('');
  };

  const removeSkill = (skillToRemove: string) => {
    setProfile({
      ...profile,
      skills: (profile.skills || []).filter((s) => s !== skillToRemove),
    });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Career Profile & Preferences
          </h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            This profile anchors your career assistant. It powers career domain matching, job search
            filters, and resume generation without needing to re-enter details repeatedly.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Identity Info */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Personal Information
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">Full Name</label>
                <input
                  type="text"
                  value={profile.name || ''}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="e.g. Maya Lin"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Email Address</label>
                <input
                  type="email"
                  value={profile.email || ''}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="maya@example.com"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Experience Level</label>
                <select
                  value={profile.experienceLevel || 'student'}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      experienceLevel: e.target.value as any,
                    })
                  }
                  className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  <option value="student">Student / Recent Graduate</option>
                  <option value="fresher">Fresher (0-1 years)</option>
                  <option value="mid">Mid-Level (2-5 years)</option>
                  <option value="senior">Senior (5+ years)</option>
                  <option value="career_transition">Career Transition / Non-Technical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Current Location</label>
                <input
                  type="text"
                  value={profile.location || ''}
                  onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                  placeholder="e.g. Austin, TX or London, UK"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Target Aspirations */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Target Roles & Preferences
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">Primary Target Role</label>
                <input
                  type="text"
                  value={profile.targetRole || ''}
                  onChange={(e) => setProfile({ ...profile, targetRole: e.target.value })}
                  placeholder="e.g. Machine Learning Engineer"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Target Domain</label>
                <input
                  type="text"
                  value={profile.targetDomain || ''}
                  onChange={(e) => setProfile({ ...profile, targetDomain: e.target.value })}
                  placeholder="e.g. Generative AI, Distributed Cloud, Fintech"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="remote-check"
                checked={Boolean(profile.remotePreference)}
                onChange={(e) => setProfile({ ...profile, remotePreference: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="remote-check" className="text-xs font-medium text-slate-700">
                Include / Prefer Remote Opportunities in Job Searches
              </label>
            </div>
          </div>

          {/* Verified Skills */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Skills & Core Technologies
            </h3>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(profile.skills || []).map((skill, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center space-x-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-100"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="text-blue-400 hover:text-red-500"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex space-x-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="Add skill (e.g. PyTorch, React, SQL) and press Enter"
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={addSkill}
                className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                Add
              </button>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center space-x-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition-colors"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Profile Saved</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Career Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
