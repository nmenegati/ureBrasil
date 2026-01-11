-- Update Geral Digital Plan
UPDATE plans 
SET 
  name = 'Carteira Estudantil Digital (Geral)',
  description = 'Carteira estudantil válida para estudantes da educação básica (ensino infantil, fundamental e médio) e do ensino superior, incluindo cursos presenciais ou a distância.'
WHERE type = 'geral_digital';

-- Update Direito Digital Plan
UPDATE plans 
SET 
  name = 'Carteira Estudantil LexPraxis',
  description = 'Carteira estudantil exclusiva para estudantes regularmente matriculados em cursos de Direito no ensino superior.'
WHERE type = 'direito_digital';
