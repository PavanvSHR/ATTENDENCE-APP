/**
 * Read-only dropdown/list data for the teacher attendance flows: which
 * subjects a teacher teaches (joined with class/division names for the
 * Create Session form), and which students sit in a division (for the
 * manual marking list and the live attendance table).
 */
import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { classesCol, divisionsCol, studentsCol, subjectsCol } from "@/firebase/firestore";
import type { StudentRecord } from "@/types";

export interface TeacherSubjectOption {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  classId: string;
  className: string;
  divisionId: string;
  divisionName: string;
}

/** Subjects the given teacher is assigned to (`teacherIds` array-contains), joined with class + division names. */
export function useTeacherSubjects(teacherId: string | undefined) {
  const [subjects, setSubjects] = useState<TeacherSubjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teacherId) {
      setSubjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const q = query(subjectsCol, where("teacherIds", "array-contains", teacherId));
    const unsubscribe = onSnapshot(
      q,
      async (snap) => {
        const rawSubjects = snap.docs.map((d) => d.data());
        if (rawSubjects.length === 0) {
          setSubjects([]);
          setLoading(false);
          return;
        }

        const classIds = Array.from(new Set(rawSubjects.map((s) => s.classId)));
        const divisionIds = Array.from(new Set(rawSubjects.map((s) => s.divisionId)));

        try {
          const [classDocs, divisionDocs] = await Promise.all([
            Promise.all(classIds.map((id) => getDoc(doc(classesCol, id)))),
            Promise.all(divisionIds.map((id) => getDoc(doc(divisionsCol, id)))),
          ]);
          const classMap = new Map(classDocs.filter((d) => d.exists()).map((d) => [d.id, d.data()]));
          const divisionMap = new Map(divisionDocs.filter((d) => d.exists()).map((d) => [d.id, d.data()]));

          setSubjects(
            rawSubjects.map((s) => ({
              subjectId: s.subjectId,
              subjectName: s.name,
              subjectCode: s.code,
              classId: s.classId,
              className: classMap.get(s.classId)?.name ?? s.classId,
              divisionId: s.divisionId,
              divisionName: divisionMap.get(s.divisionId)?.name ?? s.divisionId,
            }))
          );
        } catch {
          // Fall back to raw ids if the class/division lookup fails so the
          // form still works, just without friendly names.
          setSubjects(
            rawSubjects.map((s) => ({
              subjectId: s.subjectId,
              subjectName: s.name,
              subjectCode: s.code,
              classId: s.classId,
              className: s.classId,
              divisionId: s.divisionId,
              divisionName: s.divisionId,
            }))
          );
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [teacherId]);

  return { subjects, loading, error };
}

/** Live list of students in a division, sorted by roll number — used for the manual list and live table. */
export function useDivisionStudents(divisionId: string | undefined) {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!divisionId) {
      setStudents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    // Equality-only filter — sorted client-side to avoid depending on a
    // composite Firestore index for (divisionId ==, rollNumber asc).
    const q = query(studentsCol, where("divisionId", "==", divisionId));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => d.data());
        data.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
        setStudents(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [divisionId]);

  return { students, loading, error };
}
