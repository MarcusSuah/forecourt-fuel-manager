-- 1. Validation trigger: stock_readings physical_level cannot exceed tank capacity
CREATE OR REPLACE FUNCTION public.validate_stock_reading()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tank_capacity NUMERIC;
BEGIN
  SELECT capacity_usg INTO tank_capacity FROM public.tanks WHERE id = NEW.tank_id;
  IF tank_capacity IS NULL THEN
    RAISE EXCEPTION 'Tank not found';
  END IF;
  IF NEW.physical_level_usg < 0 THEN
    RAISE EXCEPTION 'Physical level cannot be negative';
  END IF;
  IF NEW.physical_level_usg > tank_capacity THEN
    RAISE EXCEPTION 'Closing dip (%) exceeds tank capacity (%)', NEW.physical_level_usg, tank_capacity;
  END IF;
  IF NEW.theoretical_level_usg < 0 THEN
    NEW.theoretical_level_usg := 0;
  END IF;
  IF NEW.theoretical_level_usg > tank_capacity THEN
    RAISE EXCEPTION 'Opening dip (%) exceeds tank capacity (%)', NEW.theoretical_level_usg, tank_capacity;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_stock_reading ON public.stock_readings;
CREATE TRIGGER trg_validate_stock_reading
  BEFORE INSERT OR UPDATE ON public.stock_readings
  FOR EACH ROW EXECUTE FUNCTION public.validate_stock_reading();

-- 2. Validation trigger: fuel deliveries cannot push current level over capacity
CREATE OR REPLACE FUNCTION public.validate_fuel_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tank_capacity NUMERIC;
  tank_current NUMERIC;
BEGIN
  SELECT capacity_usg, current_level_usg INTO tank_capacity, tank_current
  FROM public.tanks WHERE id = NEW.tank_id;
  IF tank_capacity IS NULL THEN
    RAISE EXCEPTION 'Tank not found';
  END IF;
  IF NEW.quantity_usg <= 0 THEN
    RAISE EXCEPTION 'Delivery quantity must be greater than zero';
  END IF;
  IF (tank_current + NEW.quantity_usg) > tank_capacity THEN
    RAISE EXCEPTION 'Delivery (%) plus current stock (%) exceeds tank capacity (%)',
      NEW.quantity_usg, tank_current, tank_capacity;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_fuel_delivery ON public.fuel_deliveries;
CREATE TRIGGER trg_validate_fuel_delivery
  BEFORE INSERT ON public.fuel_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.validate_fuel_delivery();

-- 3. Sync trigger: when a stock_reading (tank dip) is saved, update tanks.current_level_usg
-- Only if this is the latest reading for the tank
CREATE OR REPLACE FUNCTION public.sync_tank_level_from_dip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_latest BOOLEAN;
BEGIN
  -- Check if this is the latest reading (date + created_at) for this tank
  SELECT NOT EXISTS (
    SELECT 1 FROM public.stock_readings sr
    WHERE sr.tank_id = NEW.tank_id
      AND sr.id <> NEW.id
      AND (sr.date > NEW.date OR (sr.date = NEW.date AND sr.created_at > NEW.created_at))
  ) INTO is_latest;

  IF is_latest THEN
    UPDATE public.tanks
    SET current_level_usg = NEW.physical_level_usg,
        updated_at = now()
    WHERE id = NEW.tank_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tank_level_from_dip ON public.stock_readings;
CREATE TRIGGER trg_sync_tank_level_from_dip
  AFTER INSERT OR UPDATE ON public.stock_readings
  FOR EACH ROW EXECUTE FUNCTION public.sync_tank_level_from_dip();

-- 4. Validation: prevent setting tank current_level above capacity on direct edit
CREATE OR REPLACE FUNCTION public.validate_tank_level()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.current_level_usg < 0 THEN
    NEW.current_level_usg := 0;
  END IF;
  IF NEW.current_level_usg > NEW.capacity_usg THEN
    RAISE EXCEPTION 'Current level (%) cannot exceed tank capacity (%)',
      NEW.current_level_usg, NEW.capacity_usg;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_tank_level ON public.tanks;
CREATE TRIGGER trg_validate_tank_level
  BEFORE INSERT OR UPDATE ON public.tanks
  FOR EACH ROW EXECUTE FUNCTION public.validate_tank_level();