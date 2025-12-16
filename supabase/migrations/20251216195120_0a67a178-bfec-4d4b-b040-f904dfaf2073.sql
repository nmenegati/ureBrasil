-- Atualizar preços dos planos conforme especificado
UPDATE plans SET price = 44.00 WHERE type = 'geral_fisica';
UPDATE plans SET price = 44.00 WHERE type = 'direito_digital';
UPDATE plans SET price = 59.00 WHERE type = 'direito_fisica';