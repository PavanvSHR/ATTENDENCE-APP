import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface Section {
  title: string;
  body: React.ReactNode;
}

const sections: Section[] = [
  {
    title: "1. What we collect",
    body: (
      <>
        <p>To operate attendance verification and academic records, this system collects:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Identity data:</strong> full name, roll number, enrollment number, college email address, phone number (optional), class, division, and academic year/semester.</li>
          <li><strong>Attendance data:</strong> a timestamp, verification method used, and status (present/absent/late/excused) for every session you attend or are marked in.</li>
          <li><strong>Location data:</strong> your device's GPS coordinates at the moment you mark attendance, and the computed distance from the session's registered location — used only to confirm you were within the permitted geofence radius. We do not track your location at any other time.</li>
          <li><strong>Device data:</strong> a device identifier for devices you register for attendance marking, and the IP address of each attendance request, used for anti-proxy and security auditing.</li>
          <li><strong>Face verification data:</strong> if enabled by your institution, a live camera capture is processed at the moment of verification to produce a <strong>match-confidence score and a liveness (anti-spoofing) boolean only</strong>. The captured image itself is never stored, in Firestore, in Cloud Storage, or anywhere else in this system.</li>
          <li><strong>Biometric data:</strong> if enabled, on-device biometric verification (fingerprint/face unlock via the platform authenticator) produces a <strong>success/failure boolean only</strong>. No fingerprint template, face template, or other raw biometric artifact ever leaves your device or reaches our servers.</li>
          <li><strong>Profile photo:</strong> an ordinary photo you or an administrator uploads for identification in teacher-facing rosters — this is a convenience photo, not a biometric template, and is stored separately from any verification data.</li>
        </ul>
      </>
    ),
  },
  {
    title: "2. Why we collect it",
    body: (
      <p>
        The sole purpose of this data is <strong>attendance integrity</strong>: preventing proxy attendance
        (one student marking attendance for another) and giving institutions an accurate, auditable record
        of class attendance. Location and verification signals exist to make it materially harder to mark
        attendance without being physically present. Academic identity data (name, roll number, class) exists
        to route attendance records to the correct student and produce reports. We do not use this data for
        advertising, profiling, or any purpose unrelated to attendance and academic administration.
      </p>
    ),
  },
  {
    title: "3. Retention",
    body: (
      <p>
        Attendance records, audit logs, and identity data are retained for the duration of your enrollment
        plus the institution's academic record-keeping period (commonly the current academic year plus a
        further retention window set by institutional policy, since attendance can factor into academic
        eligibility decisions). Live camera frames used for face verification and biometric sensor readings
        are processed transiently and are <strong>never retained</strong> — only the resulting confidence
        score/boolean and pass/fail outcome are recorded on the attendance entry. You may request deletion of
        your account data after you are no longer enrolled, subject to the institution's legal/regulatory
        record-keeping obligations.
      </p>
    ),
  },
  {
    title: "4. Who can access what",
    body: (
      <>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Students</strong> can see only their own attendance records, notifications, and profile data.</li>
          <li><strong>Teachers</strong> can see attendance and roster data for the classes/divisions/subjects they teach — not other classes, and not other teachers' sessions.</li>
          <li><strong>Class Representatives (CRs)</strong> have the same visibility as students, plus a narrow, audited ability to mark attendance on behalf of classmates within limits set by the institution.</li>
          <li><strong>Administrators</strong> can see all attendance, academic directory, and audit data for the institution, to support reporting, corrections, and policy administration.</li>
        </ul>
        <p className="mt-3">
          <strong>Biometric and face-match confidence scores are never shown to teachers or students</strong> —
          only the resulting pass/fail outcome and the final attendance status are visible in any UI. Raw
          confidence numbers exist only transiently in the server-side verification pipeline and in
          system-internal risk scoring, never in a screen you or your teacher can see.
        </p>
      </>
    ),
  },
  {
    title: "5. Data storage and processing",
    body: (
      <p>
        Data is stored in Google Firebase (Firestore for structured records, Cloud Storage for profile
        photos only) and processed by this institution's backend service. Attendance-integrity decisions
        (geofence checks, duplicate detection, biometric/face verdicts, risk scoring) are computed
        server-side by a trusted backend process — never trusted from data a browser client could alter —
        specifically so that verification outcomes cannot be forged by tampering with the app on your device.
      </p>
    ),
  },
  {
    title: "6. Requesting corrections",
    body: (
      <p>
        If you believe an attendance record, profile detail, or other data about you is incorrect, contact
        your class teacher (for attendance corrections, which are logged and auditable) or your institution's
        administrator (for profile/identity data corrections). Corrections to finalized attendance records are
        always logged with who made the change, when, and why — you can ask your institution to show you this
        audit trail for any correction affecting your record.
      </p>
    ),
  },
  {
    title: "7. Consent and controls",
    body: (
      <p>
        Biometric and face verification are opt-in mechanisms that your institution can enable or disable
        institution-wide at any time from the admin Settings &amp; Policy page. See the{" "}
        <strong>Consent &amp; Data Notice</strong> page for the specific acknowledgement flow and what
        happens if you decline a given verification method.
      </p>
    ),
  },
  {
    title: "8. Legal compliance",
    body: (
      <p>
        This policy describes what the software collects and how it is used; it is not a substitute for
        your institution's own legal review. Institutions deploying this system are responsible for ensuring
        their use of location, biometric, and personal data complies with applicable local data-protection
        law (for example, India's Digital Personal Data Protection Act, or any equivalent regulation in their
        jurisdiction), including any required student/guardian notices, consent records, or data-processing
        agreements beyond what this application provides out of the box.
      </p>
    ),
  },
];

export function PrivacyPolicyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 py-8 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Privacy Policy</CardTitle>
          <CardDescription>
            Smart Attendance Management System — how we collect, use, and protect your data. Last updated
            2026-08-31.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-sm leading-6 text-foreground">
          {sections.map((section, i) => (
            <div key={section.title}>
              <h2 className="mb-2 text-base font-semibold">{section.title}</h2>
              <div className="space-y-2 text-muted-foreground [&_strong]:text-foreground">{section.body}</div>
              {i < sections.length - 1 && <Separator className="mt-6" />}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
