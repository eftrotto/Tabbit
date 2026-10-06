-- Diretório de funcionários: os dados de pessoas ficam fora da blockchain (LGPD).
-- On-chain só existe a carteira; aqui a empresa guarda nome, e-mail e matrícula.
-- Rodar: npm run db:migrate -w app (idempotente).

create table if not exists directory (
  employer     text        not null,  -- PDA da empresa (endereço da conta Employer)
  wallet       text        not null,  -- carteira do funcionário
  name         text,
  email        text,
  employee_id  text,                  -- matrícula, como a empresa quiser
  invited_at   timestamptz,           -- quando a carteira foi criada por convite de e-mail
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (employer, wallet)
);

create index if not exists directory_employer_email on directory (employer, lower(email));
