-- Remover política antiga que só permite UPDATE em 'pending'
DROP POLICY IF EXISTS "Users can update their own pending documents" ON documents;

-- Criar nova política que permite UPDATE em 'pending' OU 'rejected'
CREATE POLICY "Users can update their own pending or rejected documents"
ON documents
FOR UPDATE
TO authenticated
USING (
  (student_id IN (
    SELECT student_profiles.id
    FROM student_profiles
    WHERE student_profiles.user_id = auth.uid()
  ))
  AND status IN ('pending', 'rejected')
)
WITH CHECK (
  (student_id IN (
    SELECT student_profiles.id
    FROM student_profiles
    WHERE student_profiles.user_id = auth.uid()
  ))
);