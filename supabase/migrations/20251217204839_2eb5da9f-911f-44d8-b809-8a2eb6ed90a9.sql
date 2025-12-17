-- Primeiro, atualizar o registro mais recente para remover duplicidade
UPDATE student_profiles 
SET phone = '31900000001' 
WHERE id = 'acfbed13-3586-4e57-9821-5333a4a7fc20';

-- Adicionar constraint UNIQUE no telefone
ALTER TABLE student_profiles
ADD CONSTRAINT student_profiles_phone_key UNIQUE (phone);