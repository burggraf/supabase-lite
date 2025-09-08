create table
  users (
    id int8 primary key,
    name text
  );
create table
  teams (
    id int8 primary key,
    name text
  );
-- join table
create table
  users_teams (
    user_id int8 not null references users,
    team_id int8 not null references teams,
    -- both foreign keys must be part of a composite primary key
    primary key (user_id, team_id)
  );

insert into
  users (id, name)
values
  (1, 'Kiran'),
  (2, 'Evan');
insert into
  teams (id, name)
values
  (1, 'Green'),
  (2, 'Blue');
insert into
  users_teams (user_id, team_id)
values
  (1, 1),
  (1, 2),
  (2, 2);

