

 select name as label, 
 json_agg(json_build_object(select 
     'label_1', name, 
     'value', '2000', 
     'type', aggregate 
    from obs_column c, obs_column_tag ct 
   where c.id = ct.column_id 
   and ct.tag_id = t.id 
 )) as filter_1 
 from obs_tag t 
 group by id, name

 select name as label, json_agg(json_build_object(select 'label_1', name, 'value', '2000', 'type', aggregate from obs_column c, obs_column_tag ct where c.id = ct.column_id and ct.tag_id = t.id )) as filter_1 from obs_tag t group by id, name

select name as label,
json_agg((
    'label_1', name,
    'value', '2000',
    'type', aggregate
   from obs_column c, obs_column_tag ct
  where c.id = ct.column_id
  and ct.tag_id = t.id
) as filter_1
from obs_tag t
group by id, name

select name as label, (select name as label_1, '2000' as value, aggregate "type" from obs_column c, obs_column_tag ct where c.id = ct.column_id and ct.tag_id = t.id) as filter_1 from obs_tag t group by id, name

select name as label, (select json_agg(('{"label_1":"' || replace(name, '"', '\"') || '","value":"2000","type":"' || aggregate || '"}')::json) from obs_column c, obs_column_tag ctag, obs_column_table ctable, obs_table tab where c.id = ctag.column_id and ctag.tag_id = t.id and c.id = ctable.column_id and ctable.table_id = tab.id and tab.tablename = 'obs_1a098da56badf5f32e336002b0a81708c40d29cd') as filter_1 from obs_tag t group by id, name
select name as label,
json_agg(row_to_json(select name as label_1, '2000' as value, aggregate "type" from obs_column c, obs_column_tag ct where c.id = ct.column_id and ct.tag_id = t.id)) as filter_1
from obs_tag t
group by id, name
