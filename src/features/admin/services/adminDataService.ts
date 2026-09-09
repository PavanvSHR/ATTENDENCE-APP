/**
 * Admin CRUD service — direct Firestore client SDK writes against the
 * departments/classes/divisions/subjects/students/teachers/settings
 * collections. Admin writes to these collections are assumed to be allowed
 * by firestore.rules (owned by another agent, matching this design).
 *
 * NOTE ON TEACHER RECORDS: `TeacherRecord` (src/types/index.ts) does not
 * currently declare `email` or `status` fields, even though the admin UI
 * needs to capture a contact email at creation time and needs to be able to
 * disable/enable a teacher's account before any Firebase Auth user exists
 * for them. Rather than editing the shared types file (out of scope for this
 * slice) we store those two extra fields on the Firestore document anyway
 * (Firestore is schemaless) via the `TeacherRecordExt` local extension below.
 * Any code reading through the strongly-typed `teachersCol` converter simply
 * won't see them typed — which is fine, since only this service/pages read
 * them. If `TeacherRecord` is later extended officially, this already lines
 * up with it.
 */
import {
  arrayRemove,
  arrayUnion,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  departmentsCol,
  classesCol,
  divisionsCol,
  subjectsCol,
  studentsCol,
  teachersCol,
  usersCol,
  policyCol,
} from "@/firebase/firestore";
import type {
  Department,
  ClassRecord,
  Division,
  Subject,
  StudentRecord,
  TeacherRecord,
  AttendancePolicy,
  AccountStatus,
} from "@/types";
import type {
  DepartmentInput,
  ClassInput,
  SubjectInput,
  StudentInput,
  TeacherInput,
  ClassRepresentativeInput,
  AttendancePolicyInput,
} from "@/schemas/class.schema";

/** Teacher record as actually stored — see file-level note above. */
export type TeacherRecordExt = TeacherRecord & { email?: string; status?: AccountStatus };

function newId(): string {
  return crypto.randomUUID();
}

/* ---------------------------------------------------------------------- */
/* Departments                                                             */
/* ---------------------------------------------------------------------- */

export async function createDepartment(input: DepartmentInput): Promise<Department> {
  const departmentId = newId();
  const record: Department = { departmentId, ...input };
  await setDoc(doc(departmentsCol, departmentId), record);
  return record;
}

export async function updateDepartment(departmentId: string, input: DepartmentInput): Promise<void> {
  await updateDoc(doc(departmentsCol, departmentId), { ...input });
}

export async function deleteDepartment(departmentId: string): Promise<void> {
  await deleteDoc(doc(departmentsCol, departmentId));
}

/* ---------------------------------------------------------------------- */
/* Classes + Divisions                                                     */
/* ---------------------------------------------------------------------- */

/** Creates a class and one Division document per name in `input.divisions`. */
export async function createClass(input: ClassInput): Promise<ClassRecord> {
  const classId = newId();
  const record: ClassRecord = { classId, ...input };
  await setDoc(doc(classesCol, classId), record);
  await Promise.all(
    input.divisions.map((name: string) => {
      const divisionId = newId();
      const division: Division = { divisionId, classId, name, classRepresentativeIds: [] };
      return setDoc(doc(divisionsCol, divisionId), division);
    })
  );
  return record;
}

export async function getDivisionsForClass(classId: string): Promise<Division[]> {
  const snap = await getDocs(query(divisionsCol, where("classId", "==", classId)));
  return snap.docs.map((d) => d.data());
}

/**
 * Updates a class's own fields, then reconciles its Division documents
 * against the new `divisions` name list: creates a Division doc for any
 * newly-added name and deletes the Division doc for any removed name (a
 * division that still has a CR assigned will simply lose that
 * classRepresentativeIds record along with it — acceptable for an admin tool).
 */
export async function updateClass(classId: string, input: ClassInput): Promise<void> {
  await updateDoc(doc(classesCol, classId), {
    name: input.name,
    departmentId: input.departmentId,
    academicYear: input.academicYear,
    semester: input.semester,
    divisions: input.divisions,
  });

  const existingDivisions = await getDivisionsForClass(classId);
  const existingNames = new Set(existingDivisions.map((d) => d.name));
  const nextNames = new Set(input.divisions);
  const toCreate = input.divisions.filter((n: string) => !existingNames.has(n));
  const toDelete = existingDivisions.filter((d) => !nextNames.has(d.name));

  await Promise.all([
    ...toCreate.map((name: string) => {
      const divisionId = newId();
      const division: Division = { divisionId, classId, name, classRepresentativeIds: [] };
      return setDoc(doc(divisionsCol, divisionId), division);
    }),
    ...toDelete.map((d) => deleteDoc(doc(divisionsCol, d.divisionId))),
  ]);
}

export async function deleteClass(classId: string): Promise<void> {
  await deleteDoc(doc(classesCol, classId));
}

/** Adds a single new division to an existing class (used from the Classes page "add division" affordance). */
export async function addDivisionToClass(classId: string, currentDivisionNames: string[], name: string): Promise<Division> {
  const divisionId = newId();
  const division: Division = { divisionId, classId, name, classRepresentativeIds: [] };
  await setDoc(doc(divisionsCol, divisionId), division);
  await updateDoc(doc(classesCol, classId), { divisions: [...currentDivisionNames, name] });
  return division;
}

export async function deleteDivision(divisionId: string, classId: string, currentDivisionNames: string[], name: string): Promise<void> {
  await deleteDoc(doc(divisionsCol, divisionId));
  await updateDoc(doc(classesCol, classId), { divisions: currentDivisionNames.filter((d) => d !== name) });
}

/* ---------------------------------------------------------------------- */
/* Subjects                                                                */
/* ---------------------------------------------------------------------- */

export async function createSubject(input: SubjectInput): Promise<Subject> {
  const subjectId = newId();
  const record: Subject = { subjectId, ...input, teacherIds: input.teacherIds ?? [] };
  await setDoc(doc(subjectsCol, subjectId), record);
  return record;
}

export async function updateSubject(subjectId: string, input: SubjectInput): Promise<void> {
  await updateDoc(doc(subjectsCol, subjectId), { ...input, teacherIds: input.teacherIds ?? [] });
}

export async function deleteSubject(subjectId: string): Promise<void> {
  await deleteDoc(doc(subjectsCol, subjectId));
}

/* ---------------------------------------------------------------------- */
/* Students                                                                */
/* ---------------------------------------------------------------------- */

/**
 * Creates a student record with a generated studentId and an empty userId.
 * The login account (users/{uid}) is provisioned later — either when the
 * student first signs in with Google (client Auth flow matches them by
 * collegeEmail, elsewhere in the app) or via the backend admin API.
 */
export async function createStudent(input: StudentInput): Promise<StudentRecord> {
  const studentId = newId();
  const record: StudentRecord = {
    studentId,
    userId: "",
    rollNumber: input.rollNumber,
    enrollmentNumber: input.enrollmentNumber,
    name: input.name,
    collegeEmail: input.collegeEmail,
    phone: input.phone,
    classId: input.classId,
    divisionId: input.divisionId,
    academicYear: input.academicYear,
    semester: input.semester,
    status: "pending",
    faceEnrolled: false,
    biometricRegistered: false,
    registeredDeviceIds: [],
  };
  await setDoc(doc(studentsCol, studentId), record);
  return record;
}

export async function updateStudent(studentId: string, input: StudentInput): Promise<void> {
  await updateDoc(doc(studentsCol, studentId), {
    rollNumber: input.rollNumber,
    enrollmentNumber: input.enrollmentNumber,
    name: input.name,
    collegeEmail: input.collegeEmail,
    phone: input.phone,
    classId: input.classId,
    divisionId: input.divisionId,
    academicYear: input.academicYear,
    semester: input.semester,
  });
}

export async function setStudentStatus(studentId: string, status: AccountStatus): Promise<void> {
  await updateDoc(doc(studentsCol, studentId), { status });
}

export async function deleteStudent(studentId: string): Promise<void> {
  await deleteDoc(doc(studentsCol, studentId));
}

/* ---------------------------------------------------------------------- */
/* Teachers                                                                */
/* ---------------------------------------------------------------------- */

export async function createTeacher(input: TeacherInput): Promise<TeacherRecordExt> {
  const teacherId = newId();
  const record: TeacherRecordExt = {
    teacherId,
    userId: "",
    departmentId: input.departmentId,
    name: input.name,
    subjectIds: input.subjectIds ?? [],
    email: input.email,
    status: "pending",
  };
  await setDoc(doc(teachersCol, teacherId), record);
  return record;
}

export async function updateTeacher(teacherId: string, input: TeacherInput): Promise<void> {
  await updateDoc(doc(teachersCol, teacherId), {
    departmentId: input.departmentId,
    name: input.name,
    subjectIds: input.subjectIds ?? [],
    email: input.email,
  });
}

export async function setTeacherStatus(teacherId: string, status: AccountStatus): Promise<void> {
  await updateDoc(doc(teachersCol, teacherId), { status });
}

export async function deleteTeacher(teacherId: string): Promise<void> {
  await deleteDoc(doc(teachersCol, teacherId));
}

/* ---------------------------------------------------------------------- */
/* Class Representatives                                                   */
/* ---------------------------------------------------------------------- */

/**
 * Promotes a student to CR for a division: always records the studentId on
 * the Division document; if (and only if) the student already has a linked
 * users/{userId} doc (i.e. they've signed in at least once), also flips that
 * user's role to "cr". Callers must guard the "no userId yet" case in the UI.
 */
export async function promoteToClassRepresentative(
  input: ClassRepresentativeInput,
  studentUserId: string | undefined
): Promise<void> {
  await updateDoc(doc(divisionsCol, input.divisionId), {
    classRepresentativeIds: arrayUnion(input.studentId),
  });
  if (studentUserId) {
    await updateDoc(doc(usersCol, studentUserId), { role: "cr" });
  }
}

export async function revokeClassRepresentative(
  divisionId: string,
  studentId: string,
  studentUserId: string | undefined
): Promise<void> {
  await updateDoc(doc(divisionsCol, divisionId), {
    classRepresentativeIds: arrayRemove(studentId),
  });
  if (studentUserId) {
    await updateDoc(doc(usersCol, studentUserId), { role: "student" });
  }
}

/* ---------------------------------------------------------------------- */
/* Attendance Policy — single document at settings/attendancePolicy        */
/* ---------------------------------------------------------------------- */

export async function getAttendancePolicy(): Promise<AttendancePolicy | null> {
  const snap = await getDoc(doc(policyCol, "attendancePolicy"));
  return snap.exists() ? snap.data() : null;
}

export async function saveAttendancePolicy(input: AttendancePolicyInput): Promise<void> {
  await setDoc(doc(db, "settings", "attendancePolicy"), input, { merge: true });
}
